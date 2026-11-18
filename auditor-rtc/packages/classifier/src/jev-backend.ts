import { ClassifierUnavailableError, type ClassifyInput, type Decision, type DecisionBackend } from "./types.ts";

export type JevBackendOptions = {
  baseUrl?: string;
  model?: string;
  /** Neste ambiente o proxy injeta a credencial; o valor local é só um marcador. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
};

type ChoiceAnswer = { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };
type NoulAnswer = { type: "noul"; noul: number };
type SystemOneResponse = { model: string; answers: Record<string, ChoiceAnswer | NoulAnswer> };

const CHOICE_KEY = "escolha";

/** Backend TypeSafe System One (Jev): choice entre candidatos + noul para checks atômicos. */
export class JevBackend implements DecisionBackend {
  name = "jev";
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly backoffMs: number;

  constructor(opts: JevBackendOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "https://api.typesafe.ai";
    this.model = opts.model ?? "jev-latest";
    this.apiKey = opts.apiKey ?? process.env.TYPESAFE_API_KEY ?? "proxy-injected";
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.retries = opts.retries ?? 2;
    this.backoffMs = opts.backoffMs ?? 200;
  }

  async decide(input: ClassifyInput): Promise<Decision> {
    const body = JSON.stringify(this.buildRequest(input));
    let lastError = "sem tentativa";

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (attempt > 0) await sleep(this.backoffMs * 2 ** (attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(`${this.baseUrl}/v1/systemone`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
          body,
          signal: controller.signal,
        });
        if (res.ok) return this.toDecision((await res.json()) as SystemOneResponse, input);
        lastError = `Jev respondeu HTTP ${res.status}`;
        if (res.status < 500) throw new ClassifierUnavailableError(lastError);
      } catch (err) {
        if (err instanceof ClassifierUnavailableError) throw err;
        lastError = controller.signal.aborted ? `Jev excedeu ${this.timeoutMs} ms` : `Jev inacessível: ${(err as Error).message}`;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new ClassifierUnavailableError(lastError);
  }

  private buildRequest(input: ClassifyInput) {
    const questions: Record<string, unknown> = {
      [CHOICE_KEY]: {
        type: "choice",
        instructions: input.instruction,
        criteria: Object.fromEntries(input.candidates.map((c) => [c.id, c.description])),
      },
    };
    for (const check of input.checks ?? []) {
      questions[check.name] = { type: "noul", instructions: check.question };
    }
    return { model: this.model, state: input.state, questions };
  }

  private toDecision(res: SystemOneResponse, input: ClassifyInput): Decision {
    const choice = res.answers[CHOICE_KEY] as ChoiceAnswer | undefined;
    if (!choice || choice.type !== "choice") throw new ClassifierUnavailableError("resposta do Jev sem a pergunta de escolha");
    const checks: Record<string, number> = {};
    for (const check of input.checks ?? []) {
      const a = res.answers[check.name];
      if (a?.type === "noul") checks[check.name] = a.noul;
    }
    return {
      choice: choice.choice,
      confidence: choice.confidence,
      probabilities: choice.probabilities,
      checks,
      backend: this.name,
      modelVersion: res.model,
    };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

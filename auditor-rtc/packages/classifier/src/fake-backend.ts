import type { ClassifyInput, Decision, DecisionBackend } from "./types.ts";

/**
 * Backend determinístico para testes e para rodar sem rede (CLASSIFIER_BACKEND=fake).
 * Por padrão escolhe o primeiro candidato com confiança 0,5.
 */
export class FakeBackend implements DecisionBackend {
  name = "fake";
  private readonly script: (input: ClassifyInput) => Partial<Decision>;
  constructor(script: (input: ClassifyInput) => Partial<Decision> = () => ({})) {
    this.script = script;
  }

  async decide(input: ClassifyInput): Promise<Decision> {
    const first = input.candidates[0]?.id ?? "";
    const probabilities = Object.fromEntries(input.candidates.map((c) => [c.id, c.id === first ? 0.5 : 0.5 / Math.max(1, input.candidates.length - 1)]));
    return {
      choice: first,
      confidence: 0.5,
      probabilities,
      checks: {},
      backend: this.name,
      modelVersion: "fake-1",
      ...this.script(input),
    };
  }
}

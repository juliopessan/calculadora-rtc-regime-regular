/** Uma opção válida que o classificador pode escolher. */
export type Candidate = { id: string; description: string };

/** Pergunta sim/não independente, combinada depois em código. */
export type AtomicCheck = { name: string; question: string };

export type ClassifyInput = {
  /** Estado mínimo enviado ao backend. Nunca incluir dados sensíveis do cliente. */
  state: Record<string, unknown>;
  instruction: string;
  candidates: Candidate[];
  checks?: AtomicCheck[];
};

export type Decision = {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
  /** Probabilidade de "sim" para cada AtomicCheck, por nome. */
  checks: Record<string, number>;
  backend: string;
  modelVersion: string;
};

export interface DecisionBackend {
  name: string;
  decide(input: ClassifyInput): Promise<Decision>;
}

/** O backend não respondeu (rede, timeout, 5xx). O chamador deve tratar como temporário. */
export class ClassifierUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassifierUnavailableError";
  }
}

export const MAX_CANDIDATES = 255;

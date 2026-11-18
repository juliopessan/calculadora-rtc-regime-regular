import { MAX_CANDIDATES, type ClassifyInput, type Decision, type DecisionBackend } from "./types.ts";

/**
 * Escolhe um candidato. O backend só é chamado quando há escolha real a fazer,
 * e a resposta é rejeitada se sair do conjunto de candidatos.
 */
export async function classify(input: ClassifyInput, backend: DecisionBackend): Promise<Decision> {
  const { candidates } = input;
  if (candidates.length === 0) throw new Error("sem candidatos");
  if (candidates.length > MAX_CANDIDATES) throw new Error(`máximo de ${MAX_CANDIDATES} candidatos`);

  if (candidates.length === 1) {
    const id = candidates[0]!.id;
    return { choice: id, confidence: 1, probabilities: { [id]: 1 }, checks: {}, backend: "deterministico", modelVersion: "n/a" };
  }

  const decision = await backend.decide(input);
  if (!candidates.some((c) => c.id === decision.choice)) {
    throw new Error(`escolha fora dos candidatos: ${decision.choice}`);
  }
  return decision;
}

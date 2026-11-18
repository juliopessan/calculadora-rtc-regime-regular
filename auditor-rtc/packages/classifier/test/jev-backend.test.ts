import { describe, it, expect } from "vitest";
import { JevBackend, ClassifierUnavailableError, classify, type ClassifyInput } from "../src/index.ts";

const input: ClassifyInput = {
  state: { descricao: "Arroz branco tipo 1, pacote 5kg", ncm: "10063021" },
  instruction: "Qual classificação tributária IBS/CBS (cClassTrib) se aplica?",
  candidates: [
    { id: "000001", description: "Tributação integral, regra geral, sem redução" },
    { id: "200003", description: "Produto da cesta básica nacional, redução de 100% da alíquota" },
  ],
  checks: [{ name: "alimento", question: "Este item é um alimento destinado ao consumo humano?" }],
};

const okBody = {
  model: "jev-1.14.0",
  answers: {
    escolha: { type: "choice", choice: "200003", confidence: 0.88, probabilities: { "000001": 0.08, "200003": 0.92 } },
    alimento: { type: "noul", noul: 0.98 },
  },
  usage: { input_tokens: 439, output_tokens: 82 },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("JevBackend", () => {
  it("builds the System One request body", async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const backend = new JevBackend({
      apiKey: "k",
      fetchImpl: async (url, init) => { seen = { url: String(url), init: init! }; return json(200, okBody); },
    });
    await backend.decide(input);
    expect(seen!.url).toBe("https://api.typesafe.ai/v1/systemone");
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const body = JSON.parse(String(seen!.init.body));
    expect(body.model).toBe("jev-latest");
    expect(body.state).toEqual(input.state);
    expect(body.questions.escolha).toEqual({
      type: "choice",
      instructions: input.instruction,
      criteria: { "000001": "Tributação integral, regra geral, sem redução", "200003": "Produto da cesta básica nacional, redução de 100% da alíquota" },
    });
    expect(body.questions.alimento).toEqual({ type: "noul", instructions: "Este item é um alimento destinado ao consumo humano?" });
  });

  it("maps the response into a Decision", async () => {
    const backend = new JevBackend({ fetchImpl: async () => json(200, okBody) });
    const d = await backend.decide(input);
    expect(d).toEqual({
      choice: "200003", confidence: 0.88, probabilities: { "000001": 0.08, "200003": 0.92 },
      checks: { alimento: 0.98 }, backend: "jev", modelVersion: "jev-1.14.0",
    });
  });

  it("retries on 5xx then succeeds", async () => {
    let calls = 0;
    const backend = new JevBackend({
      retries: 2, backoffMs: 1,
      fetchImpl: async () => (++calls < 3 ? json(503, {}) : json(200, okBody)),
    });
    await backend.decide(input);
    expect(calls).toBe(3);
  });

  it("throws ClassifierUnavailableError after exhausting retries", async () => {
    let calls = 0;
    const backend = new JevBackend({ retries: 2, backoffMs: 1, fetchImpl: async () => { calls++; return json(500, {}); } });
    await expect(backend.decide(input)).rejects.toBeInstanceOf(ClassifierUnavailableError);
    expect(calls).toBe(3);
  });

  it("throws ClassifierUnavailableError on timeout", async () => {
    const backend = new JevBackend({
      retries: 0, timeoutMs: 20,
      fetchImpl: (_url, init) => new Promise((_res, rej) => init!.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))),
    });
    await expect(backend.decide(input)).rejects.toBeInstanceOf(ClassifierUnavailableError);
  });

  it("does not retry 4xx", async () => {
    let calls = 0;
    const backend = new JevBackend({ retries: 2, backoffMs: 1, fetchImpl: async () => { calls++; return json(422, { detail: "bad" }); } });
    await expect(backend.decide(input)).rejects.toThrow(/422/);
    expect(calls).toBe(1);
  });

  it.runIf(process.env.JEV_LIVE === "1")("live: classifies rice as cesta básica", async () => {
    const d = await classify(input, new JevBackend());
    expect(d.choice).toBe("200003");
    expect(d.checks.alimento).toBeGreaterThan(0.5);
  });
});

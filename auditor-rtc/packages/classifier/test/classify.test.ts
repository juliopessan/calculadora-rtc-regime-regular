import { describe, it, expect, vi } from "vitest";
import { classify, FakeBackend, type Candidate, type ClassifyInput } from "../src/index.ts";

const c = (id: string): Candidate => ({ id, description: `desc ${id}` });
const input = (candidates: Candidate[]): ClassifyInput => ({
  state: { descricao: "Arroz", ncm: "10063021" },
  instruction: "Qual cClassTrib?",
  candidates,
});

describe("classify", () => {
  it("rejects zero candidates", async () => {
    await expect(classify(input([]), new FakeBackend(() => ({})))).rejects.toThrow("sem candidatos");
  });

  it("short-circuits a single candidate without calling the backend", async () => {
    const backend = new FakeBackend(() => ({}));
    const spy = vi.spyOn(backend, "decide");
    const d = await classify(input([c("000001")]), backend);
    expect(d).toEqual({
      choice: "000001", confidence: 1, probabilities: { "000001": 1 },
      checks: {}, backend: "deterministico", modelVersion: "n/a",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("delegates to backend when there is more than one candidate", async () => {
    const backend = new FakeBackend(() => ({ choice: "200003", confidence: 0.9, probabilities: { "000001": 0.1, "200003": 0.9 } }));
    const d = await classify(input([c("000001"), c("200003")]), backend);
    expect(d.choice).toBe("200003");
    expect(d.confidence).toBe(0.9);
    expect(d.backend).toBe("fake");
  });

  it("rejects a backend choice outside the candidates", async () => {
    const backend = new FakeBackend(() => ({ choice: "999999" }));
    await expect(classify(input([c("000001"), c("200003")]), backend)).rejects.toThrow("escolha fora dos candidatos");
  });

  it("rejects more than 255 candidates", async () => {
    const many = Array.from({ length: 256 }, (_, i) => c(String(i).padStart(6, "0")));
    await expect(classify(input(many), new FakeBackend(() => ({})))).rejects.toThrow("máximo de 255 candidatos");
  });
});

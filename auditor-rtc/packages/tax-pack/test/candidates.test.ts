import { describe, it, expect } from "vitest";
import { CandidateIndex, EngineClient, type Classificacao } from "../src/index.ts";

const cls = (codigo: string, dfes = ["NF-e", "NFC-e"]): Classificacao => ({
  codigo, cst: codigo.slice(0, 3), descricao: `d${codigo}`, nomenclatura: "NCM",
  descricaoTratamentoTributario: "t", dfes, possuiPercentualReducao: false,
});

function fakeEngine(valid: Record<string, string[]>) {
  const calls = { classificacoes: 0, ncmAplicavel: 0 };
  const engine = {
    async classificacoes() {
      calls.classificacoes++;
      return [cls("000001"), cls("200003"), cls("200035"), cls("410004"), cls("200036", ["CT-e"]), cls("999001")];
    },
    async ncmAplicavel(c: string, ncm: string) {
      calls.ncmAplicavel++;
      return (valid[ncm] ?? []).includes(c);
    },
  };
  return { engine, calls };
}

const cenario = { versao: "t", revisadoPor: null, permitidos: ["000001", "200003", "200035", "200036"].map((codigo) => ({ codigo, motivo: "x" })) };

describe("CandidateIndex", () => {
  it("returns allowed, NF-e, NCM-valid candidates sorted by code", async () => {
    const { engine } = fakeEngine({ "10063021": ["200003", "000001", "410004"] });
    const idx = new CandidateIndex(engine, "2026-11-18", { cenario });
    expect((await idx.candidatosPara("10063021")).map((c) => c.codigo)).toEqual(["000001", "200003"]);
  });

  it("uses the cache on the second call", async () => {
    const { engine, calls } = fakeEngine({ "10063021": ["000001"] });
    const idx = new CandidateIndex(engine, "2026-11-18", { cenario });
    await idx.candidatosPara("10063021");
    const after = { ...calls };
    await idx.candidatosPara("10063021");
    expect(calls).toEqual(after);
    expect(calls.classificacoes).toBe(1);
  });

  it("filters by dfe", async () => {
    const { engine } = fakeEngine({ "10063021": ["200036"] });
    const idx = new CandidateIndex(engine, "2026-11-18", { cenario });
    expect(await idx.candidatosPara("10063021")).toEqual([]);
  });

  it("counts engine codes missing from the scenario as ignored", async () => {
    const { engine } = fakeEngine({});
    const idx = new CandidateIndex(engine, "2026-11-18", { cenario });
    await idx.candidatosPara("10063021");
    expect(idx.ignorados).toEqual(["410004", "999001"]);
  });

  it.runIf(!!process.env.ENGINE_URL)("live: rice has cesta básica and integral among few candidates", async () => {
    const idx = new CandidateIndex(new EngineClient({ baseUrl: process.env.ENGINE_URL! }), "2026-11-18");
    const codes = (await idx.candidatosPara("10063021")).map((c) => c.codigo);
    expect(codes).toContain("200003");
    expect(codes).toContain("000001");
    expect(codes.length).toBeLessThan(20);
  });
});

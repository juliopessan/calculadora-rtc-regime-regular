import { describe, it, expect } from "vitest";
import { ClassifierUnavailableError, FakeBackend, type ClassifyInput, type Decision, type DecisionBackend } from "@auditor/classifier";
import { CandidateIndex, EngineUnavailableError, type Candidato, type EngineClient, type ResultadoItem, type Verificacao } from "@auditor/tax-pack";
import { executarSku, rotear, POLITICA_PADRAO, type SkuEntrada } from "../src/index.ts";

const cand = (codigo: string): Candidato => ({
  codigo, cst: codigo.slice(0, 3), descricao: `d${codigo}`, nomenclatura: "NCM",
  descricaoTratamentoTributario: "t", dfes: ["NF-e"], possuiPercentualReducao: false,
});
const decisao = (choice: string, confidence = 0.95): Decision => ({
  choice, confidence, probabilities: { [choice]: confidence }, checks: {}, backend: "fake", modelVersion: "f",
});
const verif = (ok: boolean): Verificacao => ({ ok, estadoItem: ok ? "CALCULADO" : "INCONSISTENCIA_ENTRADA", erros: [], motorVersao: "v" });
const ctx = { data: "2026-11-18", municipio: 4314902, uf: "RS", motorVersao: "1.6.1/V0059" };
const sku: SkuEntrada = { codigo: "1", descricao: "Arroz branco tipo 1", ncmBruto: "1006.30.21" };

type EngineScript = {
  existe?: boolean;
  candidatos?: string[];
  calc?: (cClassTrib: string) => ResultadoItem | Error;
};

function deps(script: EngineScript, backend: DecisionBackend = new FakeBackend(), threshold: number | null = null) {
  const engine = {
    async ncmExiste() { return script.existe ?? true; },
    async classificacoes() { return (script.candidatos ?? []).map(cand); },
    async ncmAplicavel() { return true; },
    async calcularItem(item: { cClassTrib: string }) {
      const r = script.calc?.(item.cClassTrib) ?? { estadoItem: "CALCULADO", erros: [] };
      if (r instanceof Error) throw r;
      return r;
    },
  } as unknown as EngineClient;
  const cenario = { versao: "t", revisadoPor: null, permitidos: (script.candidatos ?? []).map((codigo) => ({ codigo, motivo: "" })) };
  const index = new CandidateIndex(engine, ctx.data, { cenario });
  return { index, backend, engine, ctx, politica: { ...POLITICA_PADRAO, threshold } };
}

describe("rotear", () => {
  it("sends everything to review without a calibrated threshold", () => {
    expect(rotear(decisao("000001", 0.99), verif(true), { threshold: null, maxTentativas: 3 })).toBe("EM_REVISAO");
  });
  it("auto-certifies at or above the threshold when verified", () => {
    expect(rotear(decisao("000001", 0.95), verif(true), { threshold: 0.9, maxTentativas: 3 })).toBe("CERTIFICADO_AUTO");
  });
  it("never auto-certifies a failed verification", () => {
    expect(rotear(decisao("000001", 0.99), verif(false), { threshold: 0.9, maxTentativas: 3 })).toBe("EM_REVISAO");
  });
  it("sends low confidence to review", () => {
    expect(rotear(decisao("000001", 0.6), verif(true), { threshold: 0.9, maxTentativas: 3 })).toBe("EM_REVISAO");
  });
});

describe("executarSku", () => {
  it("marks an invalid NCM as PENDENTE_CLIENTE", async () => {
    const r = await executarSku({ ...sku, ncmBruto: "123" }, deps({ candidatos: ["000001"] }));
    expect(r).toMatchObject({ status: "PENDENTE_CLIENTE", ncm: null, motivo: "NCM inválido" });
  });

  it("normalizes an NCM missing its leading zero", async () => {
    const r = await executarSku({ ...sku, ncmBruto: "2013000" }, deps({ candidatos: ["000001"] }));
    expect(r.ncm).toBe("02013000");
  });

  it("marks a non-existent NCM as PENDENTE_CLIENTE", async () => {
    const r = await executarSku(sku, deps({ existe: false, candidatos: ["000001"] }));
    expect(r).toMatchObject({ status: "PENDENTE_CLIENTE", motivo: "NCM inexistente ou fora de vigência" });
  });

  it("marks an NCM without candidates as PENDENTE_CLIENTE", async () => {
    const r = await executarSku(sku, deps({ candidatos: [] }));
    expect(r).toMatchObject({ status: "PENDENTE_CLIENTE", motivo: "NCM sem classificação vinculada" });
  });

  it("does not call the backend for a single candidate", async () => {
    let called = false;
    const backend = new FakeBackend(() => { called = true; return {}; });
    const r = await executarSku(sku, deps({ candidatos: ["000001"] }, backend, 0.9));
    expect(called).toBe(false);
    expect(r).toMatchObject({ status: "CERTIFICADO_AUTO", escolhido: { codigo: "000001" }, tentativas: 1 });
  });

  it("sends only descricao and ncm to the backend", async () => {
    let seen: ClassifyInput | undefined;
    const backend = new FakeBackend((input) => { seen = input; return { choice: "200003", confidence: 0.9 }; });
    await executarSku({ ...sku, gtin: "789" }, deps({ candidatos: ["000001", "200003"] }, backend));
    expect(Object.keys(seen!.state).sort()).toEqual(["descricao", "ncm"]);
    expect(seen!.state).toEqual({ descricao: "Arroz branco tipo 1", ncm: "10063021" });
  });

  it("retries with the next candidate after a REG error", async () => {
    const backend = new FakeBackend((input) => ({ choice: input.candidates.some((c) => c.id === "200003") ? "200003" : "000001", confidence: 0.95 }));
    const r = await executarSku(sku, deps({
      candidatos: ["000001", "200003"],
      calc: (c) => c === "200003" ? { estadoItem: "INCONSISTENCIA_ENTRADA", erros: [{ code: "REG-011", detail: "x" }] } : { estadoItem: "CALCULADO", erros: [] },
    }, backend, 0.9));
    expect(r).toMatchObject({ status: "CERTIFICADO_AUTO", escolhido: { codigo: "000001" }, tentativas: 2 });
  });

  it("goes to review with REG codes after exhausting attempts", async () => {
    const r = await executarSku(sku, deps({
      candidatos: ["000001", "200003"],
      calc: () => ({ estadoItem: "INCONSISTENCIA_ENTRADA", erros: [{ code: "REG-011", detail: "x" }] }),
    }, new FakeBackend(), 0.9));
    expect(r).toMatchObject({ status: "EM_REVISAO", motivo: "REG-011" });
  });

  it("maps NAO_IMPLEMENTADO to NAO_SUPORTADO", async () => {
    const r = await executarSku(sku, deps({ candidatos: ["000001"], calc: () => ({ estadoItem: "NAO_IMPLEMENTADO", erros: [] }) }));
    expect(r.status).toBe("NAO_SUPORTADO");
  });

  it("maps classifier outage to ERRO_TEMPORARIO", async () => {
    const backend: DecisionBackend = { name: "x", decide: async () => { throw new ClassifierUnavailableError("down"); } };
    const r = await executarSku(sku, deps({ candidatos: ["000001", "200003"] }, backend));
    expect(r).toMatchObject({ status: "ERRO_TEMPORARIO", motivo: "down" });
  });

  it("maps engine outage to ERRO_TEMPORARIO", async () => {
    const r = await executarSku(sku, deps({ candidatos: ["000001"], calc: () => new EngineUnavailableError("motor fora") }));
    expect(r).toMatchObject({ status: "ERRO_TEMPORARIO", motivo: "motor fora" });
  });

  it("keeps all candidates and the decision for the review screen", async () => {
    const r = await executarSku(sku, deps({ candidatos: ["000001", "200003"] }, new FakeBackend(() => ({ choice: "200003", confidence: 0.7 }))));
    expect(r.candidatos?.map((c) => c.codigo)).toEqual(["000001", "200003"]);
    expect(r.decisao?.choice).toBe("200003");
    expect(r.status).toBe("EM_REVISAO");
  });
});

import { describe, it, expect } from "vitest";
import { verificar, EngineUnavailableError, type EngineClient, type ResultadoItem, type Candidato } from "../src/index.ts";

const cand: Candidato = { codigo: "200003", cst: "200", descricao: "d", nomenclatura: "NCM", descricaoTratamentoTributario: "t", dfes: ["NF-e"], possuiPercentualReducao: true };
const ctx = { data: "2026-11-18", municipio: 4314902, uf: "RS", motorVersao: "1.6.1/V0059" };

function engineReturning(r: ResultadoItem | Error) {
  const seen: unknown[] = [];
  const engine = {
    async calcularItem(...args: unknown[]) {
      seen.push(args);
      if (r instanceof Error) throw r;
      return r;
    },
  } as unknown as EngineClient;
  return { engine, seen };
}

describe("verificar", () => {
  it("is ok for CALCULO_SIMULADO and sends cst/cClassTrib with base 100", async () => {
    const { engine, seen } = engineReturning({ estadoItem: "CALCULO_SIMULADO", erros: [], memoriaCalculo: "m" });
    const v = await verificar(engine, "10063021", cand, ctx);
    expect(v).toEqual({ ok: true, estadoItem: "CALCULO_SIMULADO", erros: [], memoriaCalculo: "m", motorVersao: "1.6.1/V0059" });
    expect(seen[0]).toEqual([{ ncm: "10063021", cst: "200", cClassTrib: "200003", baseCalculo: 100 }, "2026-11-18", 4314902, "RS"]);
  });

  it("is not ok and carries REG codes for INCONSISTENCIA_ENTRADA", async () => {
    const { engine } = engineReturning({ estadoItem: "INCONSISTENCIA_ENTRADA", erros: [{ code: "REG-011", detail: "x" }] });
    const v = await verificar(engine, "02013000", cand, ctx);
    expect(v.ok).toBe(false);
    expect(v.erros.map((e) => e.code)).toEqual(["REG-011"]);
  });

  it("propagates EngineUnavailableError", async () => {
    const { engine } = engineReturning(new EngineUnavailableError("down"));
    await expect(verificar(engine, "10063021", cand, ctx)).rejects.toBeInstanceOf(EngineUnavailableError);
  });
});

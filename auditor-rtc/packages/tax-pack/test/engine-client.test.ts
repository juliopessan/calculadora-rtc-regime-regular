import { describe, it, expect } from "vitest";
import { EngineClient, EngineUnavailableError } from "../src/index.ts";

const ENGINE_URL = process.env.ENGINE_URL;
const DATA = "2026-11-18";

describe.runIf(!!ENGINE_URL)("EngineClient (motor real)", () => {
  const engine = new EngineClient({ baseUrl: ENGINE_URL! });

  it("versao returns app and db versions", async () => {
    expect(await engine.versao()).toMatch(/^\d+\.\d+\.\d+\/V\d+$/);
  });

  it("ncmExiste distinguishes existing from missing NCM", async () => {
    expect(await engine.ncmExiste("10063021", DATA)).toBe(true);
    expect(await engine.ncmExiste("99999999", DATA)).toBe(false);
  });

  it("classificacoes includes 000001 with cst 000 and NF-e", async () => {
    const all = await engine.classificacoes(DATA);
    const integral = all.find((c) => c.codigo === "000001");
    expect(integral?.cst).toBe("000");
    expect(integral?.dfes).toContain("NF-e");
  });

  it("ncmAplicavel validates rice for cesta básica", async () => {
    expect(await engine.ncmAplicavel("200003", "10063021", DATA)).toBe(true);
  });

  it("calcularItem accepts a valid item", async () => {
    const r = await engine.calcularItem({ ncm: "10063021", cst: "200", cClassTrib: "200003", baseCalculo: 100 }, DATA, 4314902, "RS");
    expect(["CALCULADO", "CALCULO_SIMULADO"]).toContain(r.estadoItem);
    expect(r.memoriaCalculo).toMatch(/base de cálculo/i);
  });

  it("calcularItem in 2027 sends nominal rates and returns CALCULO_SIMULADO", async () => {
    const r = await engine.calcularItem({ ncm: "10063021", cst: "200", cClassTrib: "200003", baseCalculo: 100 }, "2027-03-10", 4314902, "RS");
    expect(r.estadoItem).toBe("CALCULO_SIMULADO");
  });

  it("descreverErro returns the official title", async () => {
    expect(await engine.descreverErro("REG-011")).toMatchObject({ codigo: "REG-011", titulo: "NCM não vinculada" });
  });

  it("calcularItem reports REG-011 for meat under 200035", async () => {
    const r = await engine.calcularItem({ ncm: "02013000", cst: "200", cClassTrib: "200035", baseCalculo: 100 }, DATA, 4314902, "RS");
    expect(r.estadoItem).toBe("INCONSISTENCIA_ENTRADA");
    expect(r.erros.map((e) => e.code)).toContain("REG-011");
  });
});

describe("EngineClient (unit)", () => {
  it("5xx becomes EngineUnavailableError", async () => {
    const engine = new EngineClient({ baseUrl: "http://x", fetchImpl: async () => new Response("boom", { status: 503 }) });
    await expect(engine.classificacoes(DATA)).rejects.toBeInstanceOf(EngineUnavailableError);
  });

  it("network failure becomes EngineUnavailableError", async () => {
    const engine = new EngineClient({ baseUrl: "http://x", fetchImpl: async () => { throw new TypeError("fetch failed"); } });
    await expect(engine.versao()).rejects.toBeInstanceOf(EngineUnavailableError);
  });
});

import { describe, it, expect } from "vitest";
import { JevBackend } from "@auditor/classifier";
import { CandidateIndex, EngineClient } from "@auditor/tax-pack";
import { executarSku, POLITICA_PADRAO } from "../src/index.ts";

const live = !!process.env.ENGINE_URL && process.env.JEV_LIVE === "1";

describe.runIf(live)("executarSku ao vivo (motor real + Jev)", () => {
  const engine = new EngineClient({ baseUrl: process.env.ENGINE_URL! });
  const ctx = { data: "2026-11-18", municipio: 4314902, uf: "RS", motorVersao: "live" };
  const deps = { index: new CandidateIndex(engine, ctx.data), backend: new JevBackend(), engine, ctx, politica: POLITICA_PADRAO };

  it.each([
    ["Arroz branco tipo 1, pacote 5kg", "10063021", "200003"],
    ["Cerveja pilsen lata 350ml", "22030000", "000001"],
  ])("%s → %s", async (descricao, ncmBruto, esperado) => {
    const r = await executarSku({ codigo: "x", descricao, ncmBruto }, deps);
    expect(r.escolhido?.codigo).toBe(esperado);
    expect(r.verificacao?.ok).toBe(true);
    expect(r.status).toBe("EM_REVISAO"); // sem limiar calibrado
  }, 30_000);
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FakeBackend } from "@auditor/classifier";
import { EngineUnavailableError, type EngineClient, type Classificacao } from "@auditor/tax-pack";
import { repos, type Db } from "@auditor/db";
import { createTestDb } from "@auditor/db/test-helpers";
import { processarLote, reivindicarProximoLote } from "../src/process-lote.ts";

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;
let esc: string;

const cls = (codigo: string): Classificacao => ({
  codigo, cst: codigo.slice(0, 3), descricao: `d${codigo}`, nomenclatura: "NCM",
  descricaoTratamentoTributario: "t", dfes: ["NF-e"], possuiPercentualReducao: false,
});

function fakeEngine(state: { down: boolean }) {
  return {
    async versao() { return "1.6.1/V0059"; },
    async ncmExiste(ncm: string) { return ncm !== "99999999"; },
    async classificacoes() { return [cls("000001"), cls("200003")]; },
    async ncmAplicavel() { return true; },
    async calcularItem() {
      if (state.down) throw new EngineUnavailableError("motor fora");
      return { estadoItem: "CALCULADO" as const, erros: [] };
    },
  } as unknown as EngineClient;
}

const skus = [
  { codigo: "1", descricao: "Arroz", ncmBruto: "10063021" },
  { codigo: "2", descricao: "Cerveja", ncmBruto: "22030000" },
  { codigo: "3", descricao: "Inexistente", ncmBruto: "99999999" },
];
const cenario = { versao: "t", revisadoPor: null, permitidos: [{ codigo: "000001", motivo: "" }, { codigo: "200003", motivo: "" }] };

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
  esc = (await db.criarEscritorioComSocio({ escritorio: "E", nome: "N", email: "w@e.com", senhaHash: "h" })).escritorioId;
});
afterAll(async () => t.drop());

describe("processarLote", () => {
  it("processes all skus, records events and stores the engine version", async () => {
    const lote = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "X", dataReferencia: "2026-11-18", skus }));
    const r = await processarLote(db, lote.id, { backend: new FakeBackend(), engine: fakeEngine({ down: false }), cenario });
    expect(r).toEqual({ processados: 3, temporarios: 0 });
    const out = await db.withTenant(esc, (c) => repos.listarSkus(c, lote.id));
    expect(out.map((s) => s.status)).toEqual(["EM_REVISAO", "EM_REVISAO", "PENDENTE_CLIENTE"]);
    expect(out[0]).toMatchObject({ ncm: "10063021", cst: "000", cClassTrib: "000001", tentativas: 1 });
    expect(out[0]!.candidatos).toHaveLength(2);
    const l = await db.withTenant(esc, (c) => repos.obterLote(c, lote.id));
    expect(l).toMatchObject({ status: "EM_REVISAO", motorVersao: "1.6.1/V0059" });
    const eventos = await db.withTenant(esc, async (c) => (await c.query("SELECT count(*)::int AS n FROM eventos_auditoria WHERE lote_id = $1 AND tipo = 'sku_processado'", [lote.id])).rows[0].n);
    expect(eventos).toBe(3);
  });

  it("marks skus ERRO_TEMPORARIO when the engine is down and reprocesses only them", async () => {
    const state = { down: true };
    const lote = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Y", dataReferencia: "2026-11-18", skus }));
    const first = await processarLote(db, lote.id, { backend: new FakeBackend(), engine: fakeEngine(state), cenario });
    expect(first).toEqual({ processados: 3, temporarios: 2 });
    let out = await db.withTenant(esc, (c) => repos.listarSkus(c, lote.id));
    expect(out.map((s) => s.status)).toEqual(["ERRO_TEMPORARIO", "ERRO_TEMPORARIO", "PENDENTE_CLIENTE"]);

    state.down = false;
    const second = await processarLote(db, lote.id, { backend: new FakeBackend(), engine: fakeEngine(state), cenario });
    expect(second).toEqual({ processados: 2, temporarios: 0 });
    out = await db.withTenant(esc, (c) => repos.listarSkus(c, lote.id));
    expect(out.map((s) => s.status)).toEqual(["EM_REVISAO", "EM_REVISAO", "PENDENTE_CLIENTE"]);
  });

  it("auto-certifies only when the lote has a calibrated threshold", async () => {
    const backend = new FakeBackend(() => ({ choice: "200003", confidence: 0.97 }));
    const semLimiar = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Z", dataReferencia: "2026-11-18", skus: skus.slice(0, 1) }));
    const comLimiar = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Z", dataReferencia: "2026-11-18", skus: skus.slice(0, 1), threshold: 0.95 }));
    await processarLote(db, semLimiar.id, { backend, engine: fakeEngine({ down: false }), cenario });
    await processarLote(db, comLimiar.id, { backend, engine: fakeEngine({ down: false }), cenario });
    const [a] = await db.withTenant(esc, (c) => repos.listarSkus(c, semLimiar.id));
    const [b] = await db.withTenant(esc, (c) => repos.listarSkus(c, comLimiar.id));
    expect(a!.status).toBe("EM_REVISAO");
    expect(b!.status).toBe("CERTIFICADO_AUTO");
  });
});

describe("reivindicarProximoLote", () => {
  it("claims the oldest queued lote once", async () => {
    const lote = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Q", dataReferencia: "2026-11-18", skus: [] }));
    const claimed: string[] = [];
    let next;
    while ((next = await reivindicarProximoLote(db))) claimed.push(next.loteId);
    expect(claimed).toContain(lote.id);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect((await db.withTenant(esc, (c) => repos.obterLote(c, lote.id)))!.status).toBe("PROCESSANDO");
  });
});

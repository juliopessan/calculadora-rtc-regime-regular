import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./helpers.ts";
import { repos, type Db } from "../src/index.ts";

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;
let esc: string;

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
  esc = (await db.criarEscritorioComSocio({ escritorio: "E", nome: "N", email: "n@e.com", senhaHash: "h" })).escritorioId;
});
afterAll(async () => t.drop());

const skus = [
  { codigo: "1", descricao: "Arroz", ncmBruto: "10063021" },
  { codigo: "2", descricao: "Cerveja", ncmBruto: "22030000" },
  { codigo: "3", descricao: "Carne", ncmBruto: "02013000" },
];

describe("repos", () => {
  it("creates a lote with its skus queued and reuses the client", async () => {
    const l1 = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Mercado X", dataReferencia: "2026-11-18", skus, duplicados: 2 }));
    const l2 = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Mercado X", dataReferencia: "2026-11-18", skus: [] }));
    expect(l1).toMatchObject({ status: "NA_FILA", total: 3, duplicados: 2, threshold: null });
    expect(l2.clienteId).toBe(l1.clienteId);
    const lista = await db.withTenant(esc, (c) => repos.listarSkus(c, l1.id));
    expect(lista.map((s) => [s.codigo, s.status])).toEqual([["1", "NA_FILA"], ["2", "NA_FILA"], ["3", "NA_FILA"]]);
  });

  it("counts only certified skus as billable", async () => {
    const l = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Y", dataReferencia: "2026-11-18", skus }));
    const [s1, s2, s3] = await db.withTenant(esc, (c) => repos.listarSkus(c, l.id));
    await db.withTenant(esc, async (c) => {
      await repos.atualizarSku(c, s1!.id, { status: "CERTIFICADO_AUTO" });
      await repos.atualizarSku(c, s2!.id, { status: "CERTIFICADO_REVISADO" });
      await repos.atualizarSku(c, s3!.id, { status: "PENDENTE_CLIENTE" });
    });
    expect(await db.withTenant(esc, (c) => repos.contarCobraveis(c, l.id))).toBe(2);
  });

  it("filters skus by status and lists lotes with counters", async () => {
    const l = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "Z", dataReferencia: "2026-11-18", skus }));
    const [s1] = await db.withTenant(esc, (c) => repos.listarSkus(c, l.id));
    await db.withTenant(esc, (c) => repos.atualizarSku(c, s1!.id, { status: "EM_REVISAO", cst: "200", cClassTrib: "200003", confianca: 0.8 }));
    const emRevisao = await db.withTenant(esc, (c) => repos.listarSkus(c, l.id, "EM_REVISAO"));
    expect(emRevisao.map((s) => [s.codigo, s.cClassTrib, s.confianca])).toEqual([["1", "200003", 0.8]]);
    const lotes = await db.withTenant(esc, (c) => repos.listarLotes(c));
    const linha = lotes.find((x) => x.id === l.id)!;
    expect(linha).toMatchObject({ cliente: "Z", total: 3, emRevisao: 1, certificados: 0, cobraveis: 0 });
  });

  it("concludes a lote with a report token", async () => {
    const l = await db.withTenant(esc, (c) => repos.criarLote(c, { cliente: "W", dataReferencia: "2026-11-18", skus: [] }));
    const u = await db.buscarUsuarioPorEmail("n@e.com");
    const done = await db.withTenant(esc, (c) => repos.concluirLote(c, l.id, u!.id));
    expect(done.status).toBe("CONCLUIDO");
    expect(done.tokenRelatorio).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { createTestDb } from "./helpers.ts";
import { repos, type Db } from "../src/index.ts";

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;
let a: { escritorioId: string; usuarioId: string };
let b: { escritorioId: string; usuarioId: string };

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
  a = await db.criarEscritorioComSocio({ escritorio: "Contábil A", nome: "Ana", email: "ana@a.com", senhaHash: "h" });
  b = await db.criarEscritorioComSocio({ escritorio: "Contábil B", nome: "Bia", email: "bia@b.com", senhaHash: "h" });
});
afterAll(async () => t.drop());

describe("RLS", () => {
  it("isolates tenants even on an unfiltered query", async () => {
    const lote = await db.withTenant(a.escritorioId, (c) => repos.criarLote(c, { cliente: "Mercado X", dataReferencia: "2026-11-18", skus: [] }));
    const visiveisParaB = await db.withTenant(b.escritorioId, async (c) => (await c.query("SELECT id FROM lotes")).rowCount);
    expect(visiveisParaB).toBe(0);
    expect(await db.withTenant(b.escritorioId, (c) => repos.obterLote(c, lote.id))).toBeNull();
    expect((await db.withTenant(a.escritorioId, (c) => repos.obterLote(c, lote.id)))?.id).toBe(lote.id);
  });

  it("refuses a write into another tenant", async () => {
    await expect(
      db.withTenant(b.escritorioId, (c) => c.query("INSERT INTO clientes (escritorio_id, nome) VALUES ($1, 'x')", [a.escritorioId])),
    ).rejects.toThrow(/row-level security/);
  });

  it("finds users by e-mail before a tenant is known", async () => {
    const u = await db.buscarUsuarioPorEmail("ANA@a.com");
    expect(u).toMatchObject({ id: a.usuarioId, escritorioId: a.escritorioId, papel: "socio", senhaHash: "h", nome: "Ana" });
    expect(await db.buscarUsuarioPorEmail("ninguem@x.com")).toBeNull();
  });

  it("rejects a duplicate e-mail", async () => {
    await expect(db.criarEscritorioComSocio({ escritorio: "C", nome: "Ana2", email: "ana@a.com", senhaHash: "h" })).rejects.toThrow(/e-mail já cadastrado/);
  });
});

describe("auditoria", () => {
  it("denies UPDATE/DELETE to the app role", async () => {
    await db.withTenant(a.escritorioId, (c) => repos.registrarEvento(c, { tipo: "teste", dados: {} }));
    await expect(db.withTenant(a.escritorioId, (c) => c.query("UPDATE eventos_auditoria SET tipo = 'x'"))).rejects.toThrow(/permission denied/);
    await expect(db.withTenant(a.escritorioId, (c) => c.query("DELETE FROM eventos_auditoria"))).rejects.toThrow(/permission denied/);
  });

  it("is append-only even for the table owner (trigger)", async () => {
    const owner = new pg.Client({ connectionString: t.ownerUrl });
    await owner.connect();
    try {
      await expect(owner.query("UPDATE eventos_auditoria SET tipo = 'x'")).rejects.toThrow(/somente inserção/);
      await expect(owner.query("DELETE FROM eventos_auditoria")).rejects.toThrow(/somente inserção/);
    } finally {
      await owner.end();
    }
  });
});

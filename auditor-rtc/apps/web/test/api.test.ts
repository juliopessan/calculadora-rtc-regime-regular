import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@auditor/db/test-helpers";
import { repos, type Db } from "@auditor/db";
import { setDbForTests } from "@/lib/db";
import { criarSessao, NOME_COOKIE, type Sessao } from "@/lib/session";
import { POST as criarLote, GET as listarLotes } from "@/app/api/lotes/route";
import { POST as decidir } from "@/app/api/skus/[id]/decisao/route";
import { POST as concluir } from "@/app/api/lotes/[id]/concluir/route";
import { POST as criarUsuario } from "@/app/api/usuarios/route";
import { POST as salvarMarca } from "@/app/api/marca/route";

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;
let socioA: Sessao;
let socioB: Sessao;

const latin1 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from([...s].map((ch) => ch.charCodeAt(0)));

async function req(url: string, s: Sessao | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (s) headers.set("cookie", `${NOME_COOKIE}=${await criarSessao(s)}`);
  return new Request(`http://localhost${url}`, { ...init, headers });
}
const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) });
const jsonInit = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function upload(s: Sessao, csv: Uint8Array<ArrayBuffer>, cliente = "Mercado Bom Preço") {
  const form = new FormData();
  form.set("cliente", cliente);
  form.set("dataReferencia", "2026-11-18");
  form.set("arquivo", new Blob([csv], { type: "text/csv" }), "cadastro.csv");
  return criarLote(await req("/api/lotes", s, { method: "POST", body: form }));
}

async function sessaoDe(db: Db, email: string): Promise<Sessao> {
  const u = (await db.buscarUsuarioPorEmail(email))!;
  return { usuarioId: u.id, escritorioId: u.escritorioId, papel: u.papel, nome: u.nome };
}

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
  setDbForTests(db);
  await db.criarEscritorioComSocio({ escritorio: "Contábil A", nome: "Ana", email: "ana@a.com", senhaHash: "h" });
  await db.criarEscritorioComSocio({ escritorio: "Contábil B", nome: "Bia", email: "bia@b.com", senhaHash: "h" });
  socioA = await sessaoDe(db, "ana@a.com");
  socioB = await sessaoDe(db, "bia@b.com");
});
afterAll(async () => t.drop());

describe("POST /api/lotes", () => {
  it("creates a queued lote from a Latin-1 ';' CSV", async () => {
    const r = await upload(socioA, latin1("Código;Descrição;NCM\n1;Arroz branco;1006.30.21\n2;Feijão;07133319\n3;Arroz branco;10063021\n"));
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body).toMatchObject({ total: 2, duplicados: 1, erros: [] });
    const lote = await db.withTenant(socioA.escritorioId, (c) => repos.obterLote(c, body.id));
    expect(lote).toMatchObject({ status: "NA_FILA", cliente: "Mercado Bom Preço", total: 2 });
  });

  it("returns 422 when required columns are missing", async () => {
    const r = await upload(socioA, latin1("codigo;nome\n1;Arroz\n"));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ erro: "colunas obrigatórias: descricao, ncm" });
  });

  it("requires a session", async () => {
    const r = await listarLotes(await req("/api/lotes", null));
    expect(r.status).toBe(401);
  });
});

describe("review and sign-off", () => {
  let loteId: string;
  let skuId: string;
  let analista: Sessao;
  let contador: Sessao;

  beforeAll(async () => {
    const r = await upload(socioA, latin1("codigo;descricao;ncm\n1;Arroz branco;10063021\n"));
    loteId = (await r.json()).id;
    const [sku] = await db.withTenant(socioA.escritorioId, (c) => repos.listarSkus(c, loteId));
    skuId = sku!.id;
    const candidatos = [
      { codigo: "000001", cst: "000", descricao: "Integral", descricaoTratamentoTributario: "t", nomenclatura: "", dfes: ["NF-e"], possuiPercentualReducao: false },
      { codigo: "200003", cst: "200", descricao: "Cesta básica", descricaoTratamentoTributario: "t", nomenclatura: "", dfes: ["NF-e"], possuiPercentualReducao: true },
    ];
    await db.withTenant(socioA.escritorioId, async (c) => {
      await repos.atualizarSku(c, skuId, { status: "EM_REVISAO", cst: "200", cClassTrib: "200003", confianca: 0.8, candidatos });
      await repos.atualizarLote(c, loteId, { status: "EM_REVISAO" });
    });

    for (const [email, papel] of [["ana.analista@a.com", "analista"], ["carlos@a.com", "contador_responsavel"]] as const) {
      const res = await criarUsuario(await req("/api/usuarios", socioA, jsonInit({ nome: email, email, papel, senha: "senha-temporaria-1" })));
      expect(res.status).toBe(201);
    }
    analista = await sessaoDe(db, "ana.analista@a.com");
    contador = await sessaoDe(db, "carlos@a.com");
  });

  it("only a sócio can create users", async () => {
    const r = await criarUsuario(await req("/api/usuarios", analista, jsonInit({ nome: "x", email: "x@a.com", papel: "analista", senha: "senha-temporaria-1" })));
    expect(r.status).toBe(403);
  });

  it("rejects switching to a cClassTrib outside the valid candidates", async () => {
    const r = await decidir(await req(`/api/skus/${skuId}/decisao`, analista, jsonInit({ acao: "trocar", cClassTrib: "410004" })), params({ id: skuId }));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ erro: "cClassTrib fora dos candidatos válidos" });
  });

  it("does not let another office see the lote or decide its SKU", async () => {
    const r = await decidir(await req(`/api/skus/${skuId}/decisao`, socioB, jsonInit({ acao: "aprovar" })), params({ id: skuId }));
    expect(r.status).toBe(404);
    const c = await concluir(await req(`/api/lotes/${loteId}/concluir`, socioB, { method: "POST" }), params({ id: loteId }));
    expect(c.status).toBe(404);
  });

  it("refuses to conclude while SKUs are pending review", async () => {
    const r = await concluir(await req(`/api/lotes/${loteId}/concluir`, contador, { method: "POST" }), params({ id: loteId }));
    expect(r.status).toBe(409);
    expect((await r.json()).erro).toMatch(/1 SKU/);
  });

  it("lets an analyst switch within candidates, recording the change", async () => {
    const r = await decidir(await req(`/api/skus/${skuId}/decisao`, analista, jsonInit({ acao: "trocar", cClassTrib: "000001", justificativa: "não é cesta básica" })), params({ id: skuId }));
    expect(r.status).toBe(200);
    const sku = await db.withTenant(socioA.escritorioId, (c) => repos.obterSku(c, skuId));
    expect(sku).toMatchObject({ status: "CERTIFICADO_REVISADO", cst: "000", cClassTrib: "000001", revisadoPor: analista.usuarioId });
  });

  it("does not let an analyst conclude the lote", async () => {
    const r = await concluir(await req(`/api/lotes/${loteId}/concluir`, analista, { method: "POST" }), params({ id: loteId }));
    expect(r.status).toBe(403);
  });

  it("lets the contador responsável conclude, issuing a report token", async () => {
    const r = await concluir(await req(`/api/lotes/${loteId}/concluir`, contador, { method: "POST" }), params({ id: loteId }));
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.tokenRelatorio).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const eventos = await db.withTenant(socioA.escritorioId, async (c) =>
      (await c.query("SELECT tipo FROM eventos_auditoria WHERE lote_id = $1 ORDER BY id", [loteId])).rows.map((x) => x.tipo));
    expect(eventos).toEqual(expect.arrayContaining(["sku_decidido", "lote_assinado"]));
  });

  it("refuses decisions on a concluded lote", async () => {
    const r = await decidir(await req(`/api/skus/${skuId}/decisao`, contador, jsonInit({ acao: "devolver" })), params({ id: skuId }));
    expect(r.status).toBe(409);
  });
});

describe("POST /api/marca", () => {
  it("lets only the sócio change branding and validates the color", async () => {
    const analista = await sessaoDe(db, "ana.analista@a.com");
    expect((await salvarMarca(await req("/api/marca", analista, jsonInit({ nome: "X", corPrimaria: "#000000" })))).status).toBe(403);
    expect((await salvarMarca(await req("/api/marca", socioA, jsonInit({ nome: "X", corPrimaria: "azul" })))).status).toBe(422);
    const ok = await salvarMarca(await req("/api/marca", socioA, jsonInit({ nome: "Contábil Alfa", corPrimaria: "#0a7c66", logoUrl: "https://exemplo.com/logo.png" })));
    expect(ok.status).toBe(200);
    const e = await db.withTenant(socioA.escritorioId, (c) => repos.obterEscritorio(c));
    expect(e).toMatchObject({ nome: "Contábil Alfa", corPrimaria: "#0a7c66", logoUrl: "https://exemplo.com/logo.png" });
  });
});

describe("POST /api/lotes/[id]/reprocessar", () => {
  it("re-queues a lote under review and 404s for another office", async () => {
    const { POST: reprocessar } = await import("@/app/api/lotes/[id]/reprocessar/route");
    const r = await upload(socioA, latin1("descricao;ncm\nArroz;10063021\n"), "Reprocesso");
    const id = (await r.json()).id;
    expect((await reprocessar(await req(`/api/lotes/${id}/reprocessar`, socioA, { method: "POST" }), params({ id }))).status).toBe(409);
    await db.withTenant(socioA.escritorioId, (c) => repos.atualizarLote(c, id, { status: "EM_REVISAO" }));
    expect((await reprocessar(await req(`/api/lotes/${id}/reprocessar`, socioB, { method: "POST" }), params({ id }))).status).toBe(404);
    expect((await reprocessar(await req(`/api/lotes/${id}/reprocessar`, socioA, { method: "POST" }), params({ id }))).status).toBe(200);
    expect((await db.withTenant(socioA.escritorioId, (c) => repos.obterLote(c, id)))!.status).toBe("NA_FILA");
  });
});

describe("regime do cliente", () => {
  async function uploadRegime(regime: string | null) {
    const form = new FormData();
    form.set("cliente", `Regime ${regime}`);
    form.set("dataReferencia", "2026-11-18");
    if (regime !== null) form.set("regime", regime);
    form.set("arquivo", new Blob([latin1("descricao;ncm\nArroz;10063021\n")], { type: "text/csv" }), "c.csv");
    return criarLote(await req("/api/lotes", socioA, { method: "POST", body: form }));
  }

  it("stores regime=simples", async () => {
    const r = await uploadRegime("simples");
    expect(r.status).toBe(201);
    const id = (await r.json()).id;
    expect((await db.withTenant(socioA.escritorioId, (c) => repos.obterLote(c, id)))!.regime).toBe("simples");
  });

  it("defaults to regular", async () => {
    const id = (await (await uploadRegime(null)).json()).id;
    expect((await db.withTenant(socioA.escritorioId, (c) => repos.obterLote(c, id)))!.regime).toBe("regular");
  });

  it("rejects an unknown regime", async () => {
    const r = await uploadRegime("lucro-presumido");
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ erro: "Regime inválido" });
  });
});

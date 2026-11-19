import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@auditor/db/test-helpers";
import { repos, type Db } from "@auditor/db";
import { setDbForTests } from "@/lib/db";
import { criarSessao, NOME_COOKIE, type Sessao } from "@/lib/session";
import { GET as obter } from "@/app/api/calibracao/route";
import { POST as aplicar } from "@/app/api/calibracao/aplicar/route";
import { POST as criarLote } from "@/app/api/lotes/route";
import { POST as criarUsuario } from "@/app/api/usuarios/route";

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;
let socio: Sessao;
let contador: Sessao;
let analista: Sessao;

async function req(url: string, s: Sessao, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${NOME_COOKIE}=${await criarSessao(s)}`);
  return new Request(`http://localhost${url}`, { ...init, headers });
}
const jsonInit = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
async function sessaoDe(email: string): Promise<Sessao> {
  const u = (await db.buscarUsuarioPorEmail(email))!;
  return { usuarioId: u.id, escritorioId: u.escritorioId, papel: u.papel, nome: u.nome };
}

/** Cria n SKUs revisados por humano com a escolha original do modelo. */
async function semear(n: number, gerar: (i: number) => { correto: boolean; confianca: number }) {
  await db.withTenant(socio.escritorioId, async (c) => {
    const skus = Array.from({ length: n }, (_, i) => ({ codigo: String(i), descricao: `Item ${i}`, ncmBruto: "10063021" }));
    const lote = await repos.criarLote(c, { cliente: `Ouro ${n}`, dataReferencia: "2026-11-18", skus });
    const linhas = await repos.listarSkus(c, lote.id);
    for (const [i, s] of linhas.entries()) {
      const g = gerar(i);
      await repos.atualizarSku(c, s.id, { status: "CERTIFICADO_REVISADO", cClassTrib: g.correto ? "200003" : "000001", escolhaModelo: "200003", confiancaModelo: g.confianca, backendModelo: "jev" });
    }
  });
}

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
  setDbForTests(db);
  await db.criarEscritorioComSocio({ escritorio: "Calib", nome: "Sócia", email: "s@c.com", senhaHash: "h" });
  socio = await sessaoDe("s@c.com");
  for (const [email, papel] of [["k@c.com", "contador_responsavel"], ["a@c.com", "analista"]] as const) {
    await criarUsuario(await req("/api/usuarios", socio, jsonInit({ nome: email, email, papel, senha: "senha-temporaria-1" })));
  }
  contador = await sessaoDe("k@c.com");
  analista = await sessaoDe("a@c.com");
});
afterAll(async () => t.drop());

describe("calibração", () => {
  it("has no threshold below 300 labeled samples", async () => {
    await semear(100, () => ({ correto: true, confianca: 0.95 }));
    const body = await (await obter(await req("/api/calibracao", socio))).json();
    expect(body).toMatchObject({ amostras: 100, minimo: 300, alvo: 0.99, limiarAtual: null });
    expect(body.relatorio.threshold).toBeNull();
  });

  it("ignores legacy SKUs without the model's original choice", async () => {
    await db.withTenant(socio.escritorioId, async (c) => {
      const l = await repos.criarLote(c, { cliente: "Legado", dataReferencia: "2026-11-18", skus: [{ codigo: "x", descricao: "x", ncmBruto: "10063021" }] });
      const [s] = await repos.listarSkus(c, l.id);
      await repos.atualizarSku(c, s!.id, { status: "CERTIFICADO_REVISADO", cClassTrib: "000001" });
    });
    expect((await (await obter(await req("/api/calibracao", socio))).json()).amostras).toBe(100);
  });

  it("labels compare the final code with the model choice and suggest 0.9", async () => {
    // +200 → 300 no total: 4 erradas com conf 0,5 (precisão geral 98,7% < 99%) e o resto correto com conf ≥ 0,9.
    await semear(200, (i) => (i < 4 ? { correto: false, confianca: 0.5 } : { correto: true, confianca: 0.9 }));
    const body = await (await obter(await req("/api/calibracao", socio))).json();
    expect(body.amostras).toBe(300);
    expect(body.relatorio.threshold).toBe(0.9);
  });

  it("does not let an analyst apply", async () => {
    expect((await aplicar(await req("/api/calibracao/aplicar", analista, jsonInit({ threshold: 0.9 })))).status).toBe(403);
  });

  it("rejects a forged threshold", async () => {
    const r = await aplicar(await req("/api/calibracao/aplicar", contador, jsonInit({ threshold: 0.5 })));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ erro: "Aplique o limiar sugerido pela calibração" });
  });

  it("applies the suggested threshold and new lotes inherit it", async () => {
    expect((await aplicar(await req("/api/calibracao/aplicar", contador, jsonInit({ threshold: 0.9 })))).status).toBe(200);
    expect((await (await obter(await req("/api/calibracao", socio))).json()).limiarAtual).toBe(0.9);
    const form = new FormData();
    form.set("cliente", "Herda");
    form.set("arquivo", new Blob(["descricao;ncm\nArroz;10063021\n"], { type: "text/csv" }), "c.csv");
    const id = (await (await criarLote(await req("/api/lotes", socio, { method: "POST", body: form }))).json()).id;
    expect((await db.withTenant(socio.escritorioId, (c) => repos.obterLote(c, id)))!.threshold).toBe(0.9);
  });

  it("null turns automatic certification off", async () => {
    expect((await aplicar(await req("/api/calibracao/aplicar", contador, jsonInit({ threshold: null })))).status).toBe(200);
    expect((await (await obter(await req("/api/calibracao", socio))).json()).limiarAtual).toBeNull();
  });
});

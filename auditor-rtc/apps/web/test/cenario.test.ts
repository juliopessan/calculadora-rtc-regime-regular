import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@auditor/db/test-helpers";
import { repos, type Db } from "@auditor/db";
import { CENARIO_VENDA_INTERNA_V1 } from "@auditor/tax-pack";
import { setDbForTests } from "@/lib/db";
import { criarSessao, NOME_COOKIE, type Sessao } from "@/lib/session";
import { POST as revisar } from "@/app/api/cenario/revisao/route";
import { POST as criarUsuario } from "@/app/api/usuarios/route";

let t: Awaited<ReturnType<typeof createTestDb>>;
let db: Db;
let socio: Sessao;
let contador: Sessao;

async function req(url: string, s: Sessao, body: unknown) {
  return new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json", cookie: `${NOME_COOKIE}=${await criarSessao(s)}` }, body: JSON.stringify(body) });
}
async function sessaoDe(email: string): Promise<Sessao> {
  const u = (await db.buscarUsuarioPorEmail(email))!;
  return { usuarioId: u.id, escritorioId: u.escritorioId, papel: u.papel, nome: u.nome };
}
const todos = (decisao: (codigo: string) => "concordo" | "discordo") =>
  CENARIO_VENDA_INTERNA_V1.permitidos.map((p) => ({ codigo: p.codigo, decisao: decisao(p.codigo), comentario: "" }));

beforeAll(async () => {
  t = await createTestDb();
  db = t.db;
  setDbForTests(db);
  await db.criarEscritorioComSocio({ escritorio: "Cen", nome: "Sócia", email: "s@cen.com", senhaHash: "h" });
  socio = await sessaoDe("s@cen.com");
  await criarUsuario(await req("/api/usuarios", socio, { nome: "Contador", email: "k@cen.com", papel: "contador_responsavel", senha: "senha-temporaria-1" }));
  contador = await sessaoDe("k@cen.com");
});
afterAll(async () => t.drop());

describe("revisão do cenário", () => {
  it("only the contador responsável signs", async () => {
    expect((await revisar(await req("/api/cenario/revisao", socio, { itens: todos(() => "concordo") }))).status).toBe(403);
  });

  it("requires every permitted code", async () => {
    const r = await revisar(await req("/api/cenario/revisao", contador, { itens: todos(() => "concordo").slice(1) }));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ erro: "Revise todos os códigos permitidos" });
  });

  it("rejects codes outside the scenario and malformed suggestions", async () => {
    const extra = await revisar(await req("/api/cenario/revisao", contador, { itens: [...todos(() => "concordo"), { codigo: "999999", decisao: "concordo" }] }));
    expect(extra.status).toBe(422);
    const sug = await revisar(await req("/api/cenario/revisao", contador, { itens: todos(() => "concordo"), sugeridos: ["abc"] }));
    expect(sug.status).toBe(422);
  });

  it("stores a complete signed review with disagreements and suggestions", async () => {
    const r = await revisar(await req("/api/cenario/revisao", contador, { itens: todos((c) => (c === "410009" ? "discordo" : "concordo")), sugeridos: ["200005"] }));
    expect(r.status).toBe(201);
    const ultima = await db.withTenant(contador.escritorioId, (c) => repos.ultimaRevisaoCenario(c, CENARIO_VENDA_INTERNA_V1.versao));
    expect(ultima).toMatchObject({ cenarioVersao: "venda-interna-v1", discordancias: 1, sugeridos: ["200005"], assinadoPor: "Contador" });
  });

  it("returns null when the version was never reviewed", async () => {
    expect(await db.withTenant(contador.escritorioId, (c) => repos.ultimaRevisaoCenario(c, "venda-interna-v2"))).toBeNull();
  });
});

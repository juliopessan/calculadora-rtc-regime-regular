import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "@auditor/db/test-helpers";
import { setDbForTests } from "@/lib/db";
import { criarSessao, lerSessao, NOME_COOKIE } from "@/lib/session";
import { exigirPapel, RespostaHttp } from "@/lib/auth";
import { POST as cadastro } from "@/app/api/auth/cadastro/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
  setDbForTests(t.db);
});
afterAll(async () => t.drop());

const json = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const cookieFrom = (res: Response) => res.headers.get("set-cookie")!.split(";")[0]!;

describe("auth", () => {
  it("signs up an office, then logs in with a session cookie", async () => {
    const r1 = await cadastro(json("/api/auth/cadastro", { escritorio: "Contábil Silva", nome: "Ana", email: "ana@silva.com", senha: "senha-forte-123" }));
    expect(r1.status).toBe(201);
    expect(r1.headers.get("set-cookie")).toMatch(new RegExp(`^${NOME_COOKIE}=.+HttpOnly`, "i"));

    const r2 = await login(json("/api/auth/login", { email: "ANA@silva.com", senha: "senha-forte-123" }));
    expect(r2.status).toBe(200);
    const s = await lerSessao(new Request("http://localhost/", { headers: { cookie: cookieFrom(r2) } }));
    expect(s).toMatchObject({ papel: "socio", nome: "Ana" });
  });

  it("returns a generic 401 for a wrong password or unknown e-mail", async () => {
    for (const body of [{ email: "ana@silva.com", senha: "errada" }, { email: "x@y.com", senha: "qualquer" }]) {
      const r = await login(json("/api/auth/login", body));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ erro: "E-mail ou senha inválidos" });
    }
  });

  it("rejects short passwords and duplicate e-mails at signup", async () => {
    expect((await cadastro(json("/api/auth/cadastro", { escritorio: "X", nome: "X", email: "x@x.com", senha: "123" }))).status).toBe(422);
    const dup = await cadastro(json("/api/auth/cadastro", { escritorio: "Y", nome: "Y", email: "ana@silva.com", senha: "senha-forte-123" }));
    expect(dup.status).toBe(409);
  });

  it("ignores a tampered session", async () => {
    const token = await criarSessao({ usuarioId: "u", escritorioId: "e", papel: "socio", nome: "n" });
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(await lerSessao(new Request("http://localhost/", { headers: { cookie: `${NOME_COOKIE}=${tampered}` } }))).toBeNull();
  });

  it("logout clears the cookie", async () => {
    const r = await logout(new Request("http://localhost/api/auth/logout", { method: "POST" }));
    expect(r.headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });

  it("exigirPapel throws 403 for a disallowed role", () => {
    const s = { usuarioId: "u", escritorioId: "e", papel: "analista" as const, nome: "n" };
    expect(() => exigirPapel(s, "contador_responsavel")).toThrow(RespostaHttp);
    try { exigirPapel(s, "contador_responsavel"); } catch (e) { expect((e as RespostaHttp).status).toBe(403); }
    expect(() => exigirPapel(s, "analista", "socio")).not.toThrow();
  });
});

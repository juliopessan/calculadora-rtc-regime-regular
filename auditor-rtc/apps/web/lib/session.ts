import { SignJWT, jwtVerify } from "jose";
import type { Papel } from "@auditor/db";

export type Sessao = { usuarioId: string; escritorioId: string; papel: Papel; nome: string };

export const NOME_COOKIE = "auditor_sessao";
const DURACAO_S = 12 * 60 * 60;

function segredo(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET ausente ou com menos de 32 caracteres");
  return new TextEncoder().encode(s);
}

export async function criarSessao(s: Sessao): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_S}s`)
    .sign(segredo());
}

export async function lerSessaoDeToken(token: string | undefined): Promise<Sessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: ["HS256"] });
    const { usuarioId, escritorioId, papel, nome } = payload as Record<string, unknown>;
    if (typeof usuarioId !== "string" || typeof escritorioId !== "string" || typeof papel !== "string" || typeof nome !== "string") return null;
    return { usuarioId, escritorioId, papel: papel as Papel, nome };
  } catch {
    return null;
  }
}

export function lerCookie(header: string | null, nome = NOME_COOKIE): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === nome) return v.join("=");
  }
  return undefined;
}

export function lerSessao(req: Request): Promise<Sessao | null> {
  return lerSessaoDeToken(lerCookie(req.headers.get("cookie")));
}

export function cookieSessao(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${NOME_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACAO_S}${secure}`;
}

export function cookieLimpo(): string {
  return `${NOME_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

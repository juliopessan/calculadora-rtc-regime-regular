import type { Papel } from "@auditor/db";
import { lerSessao, type Sessao } from "./session";

/** Erro que vira resposta HTTP com {erro: mensagem}. */
export class RespostaHttp extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function exigirPapel(s: Sessao, ...papeis: Papel[]): void {
  if (!papeis.includes(s.papel)) throw new RespostaHttp(403, "Seu papel não permite esta ação");
}

export async function exigirSessao(req: Request): Promise<Sessao> {
  const s = await lerSessao(req);
  if (!s) throw new RespostaHttp(401, "Faça login para continuar");
  return s;
}

export const jsonResp = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/** Envolve um handler: RespostaHttp → JSON com o status; outros erros → 500 genérico. */
export function rota(fn: (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> } = { params: Promise.resolve({}) }) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof RespostaHttp) return jsonResp(err.status, { erro: err.message });
      console.error(err);
      return jsonResp(500, { erro: "Erro interno" });
    }
  };
}

export async function lerJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new RespostaHttp(400, "Corpo da requisição inválido");
  }
}

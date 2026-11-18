import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { criarSessao, cookieSessao } from "@/lib/session";
import { jsonResp, lerJson, rota, RespostaHttp } from "@/lib/auth";

type Corpo = { escritorio?: string; nome?: string; email?: string; senha?: string };

export const POST = rota(async (req) => {
  const b = await lerJson<Corpo>(req);
  const escritorio = b.escritorio?.trim();
  const nome = b.nome?.trim();
  const email = b.email?.trim().toLowerCase();
  if (!escritorio || !nome || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RespostaHttp(422, "Preencha escritório, nome e um e-mail válido");
  if (!b.senha || b.senha.length < 10) throw new RespostaHttp(422, "A senha precisa ter pelo menos 10 caracteres");

  const senhaHash = await bcrypt.hash(b.senha, 10);
  let ids;
  try {
    ids = await getDb().criarEscritorioComSocio({ escritorio, nome, email, senhaHash });
  } catch (err) {
    if ((err as Error).message === "e-mail já cadastrado") throw new RespostaHttp(409, "Este e-mail já está cadastrado");
    throw err;
  }
  const token = await criarSessao({ ...ids, papel: "socio", nome });
  return jsonResp(201, { ok: true }, { "Set-Cookie": cookieSessao(token) });
});

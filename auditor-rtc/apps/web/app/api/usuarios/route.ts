import bcrypt from "bcryptjs";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { exigirPapel, exigirSessao, jsonResp, lerJson, rota, RespostaHttp } from "@/lib/auth";

const PAPEIS = ["socio", "contador_responsavel", "analista"] as const;
type Corpo = { nome?: string; email?: string; papel?: (typeof PAPEIS)[number]; senha?: string };

export const GET = rota(async (req) => {
  const s = await exigirSessao(req);
  return jsonResp(200, await getDb().withTenant(s.escritorioId, (c) => repos.listarUsuarios(c)));
});

export const POST = rota(async (req) => {
  const s = await exigirSessao(req);
  exigirPapel(s, "socio");
  const b = await lerJson<Corpo>(req);
  const email = b.email?.trim().toLowerCase();
  if (!b.nome?.trim() || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RespostaHttp(422, "Informe nome e e-mail válidos");
  if (!b.papel || !PAPEIS.includes(b.papel)) throw new RespostaHttp(422, "Papel inválido");
  if (!b.senha || b.senha.length < 10) throw new RespostaHttp(422, "A senha temporária precisa ter pelo menos 10 caracteres");
  const senhaHash = await bcrypt.hash(b.senha, 10);
  try {
    const id = await getDb().withTenant(s.escritorioId, async (c) => {
      const novo = await repos.criarUsuario(c, { nome: b.nome!.trim(), email, senhaHash, papel: b.papel! });
      await repos.registrarEvento(c, { usuarioId: s.usuarioId, tipo: "usuario_criado", dados: { novo, papel: b.papel } });
      return novo;
    });
    return jsonResp(201, { id });
  } catch (err) {
    if ((err as Error).message === "e-mail já cadastrado") throw new RespostaHttp(409, "Este e-mail já está cadastrado");
    throw err;
  }
});

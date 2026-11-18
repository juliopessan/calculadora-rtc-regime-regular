import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { criarSessao, cookieSessao } from "@/lib/session";
import { jsonResp, lerJson, rota, RespostaHttp } from "@/lib/auth";

// Hash fixo para comparar mesmo quando o e-mail não existe (tempo de resposta uniforme).
const HASH_FALSO = bcrypt.hashSync("senha-inexistente-para-tempo-uniforme", 10);

export const POST = rota(async (req) => {
  const b = await lerJson<{ email?: string; senha?: string }>(req);
  const u = b.email ? await getDb().buscarUsuarioPorEmail(b.email.trim()) : null;
  const ok = await bcrypt.compare(b.senha ?? "", u?.senhaHash ?? HASH_FALSO);
  if (!u || !ok) throw new RespostaHttp(401, "E-mail ou senha inválidos");
  const token = await criarSessao({ usuarioId: u.id, escritorioId: u.escritorioId, papel: u.papel, nome: u.nome });
  return jsonResp(200, { ok: true }, { "Set-Cookie": cookieSessao(token) });
});

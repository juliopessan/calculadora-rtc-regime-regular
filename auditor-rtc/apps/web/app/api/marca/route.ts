import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { exigirPapel, exigirSessao, jsonResp, lerJson, rota, RespostaHttp } from "@/lib/auth";

export const POST = rota(async (req) => {
  const s = await exigirSessao(req);
  exigirPapel(s, "socio");
  const b = await lerJson<{ nome?: string; corPrimaria?: string; logoUrl?: string | null }>(req);
  const nome = b.nome?.trim();
  if (!nome) throw new RespostaHttp(422, "Informe o nome do escritório");
  if (!b.corPrimaria || !/^#[0-9a-fA-F]{6}$/.test(b.corPrimaria)) throw new RespostaHttp(422, "Cor inválida (use o formato #1f4e79)");
  const logoUrl = b.logoUrl?.trim() || null;
  if (logoUrl && !/^https:\/\/[^\s"'<>]+$/.test(logoUrl)) throw new RespostaHttp(422, "O logo precisa ser um endereço https://");
  await getDb().withTenant(s.escritorioId, async (c) => {
    await repos.atualizarMarca(c, { nome, corPrimaria: b.corPrimaria!, logoUrl });
    await repos.registrarEvento(c, { usuarioId: s.usuarioId, tipo: "marca_atualizada", dados: { nome, corPrimaria: b.corPrimaria, logoUrl } });
  });
  return jsonResp(200, { ok: true });
});

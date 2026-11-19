import { repos, type ItemRevisaoCenario } from "@auditor/db";
import { CENARIO_VENDA_INTERNA_V1 } from "@auditor/tax-pack";
import { getDb } from "@/lib/db";
import { exigirPapel, exigirSessao, jsonResp, lerJson, rota, RespostaHttp } from "@/lib/auth";

type Corpo = { itens?: ItemRevisaoCenario[]; sugeridos?: string[] };

/** O contador responsável assina a revisão do cenário vigente: cada código permitido precisa de uma decisão. */
export const POST = rota(async (req) => {
  const s = await exigirSessao(req);
  exigirPapel(s, "contador_responsavel");
  const b = await lerJson<Corpo>(req);
  const cenario = CENARIO_VENDA_INTERNA_V1;
  const permitidos = new Set(cenario.permitidos.map((p) => p.codigo));
  const itens = Array.isArray(b.itens) ? b.itens : [];

  for (const i of itens) {
    if (!permitidos.has(i.codigo)) throw new RespostaHttp(422, `Código fora do cenário: ${i.codigo}`);
    if (i.decisao !== "concordo" && i.decisao !== "discordo") throw new RespostaHttp(422, `Decisão inválida para ${i.codigo}`);
  }
  const revisados = new Set(itens.map((i) => i.codigo));
  if (revisados.size !== permitidos.size || itens.length !== permitidos.size) throw new RespostaHttp(422, "Revise todos os códigos permitidos");

  const sugeridos = Array.isArray(b.sugeridos) ? b.sugeridos : [];
  for (const c of sugeridos) {
    if (!/^\d{6}$/.test(c) || permitidos.has(c)) throw new RespostaHttp(422, `Sugestão inválida: ${c}`);
  }

  const limpos = itens.map((i) => ({ codigo: i.codigo, decisao: i.decisao, comentario: (i.comentario ?? "").trim().slice(0, 500) }));
  await getDb().withTenant(s.escritorioId, async (c) => {
    await repos.registrarRevisaoCenario(c, { cenarioVersao: cenario.versao, usuarioId: s.usuarioId, itens: limpos, sugeridos: [...new Set(sugeridos)] });
    await repos.registrarEvento(c, { usuarioId: s.usuarioId, tipo: "cenario_revisado", dados: { versao: cenario.versao, discordancias: limpos.filter((i) => i.decisao === "discordo").length, sugeridos } });
  });
  return jsonResp(201, { ok: true });
});

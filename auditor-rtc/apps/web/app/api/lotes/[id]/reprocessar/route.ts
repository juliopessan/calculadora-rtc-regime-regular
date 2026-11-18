import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { exigirSessao, jsonResp, rotaComParams, RespostaHttp } from "@/lib/auth";

/** Devolve o lote à fila para o worker reprocessar só os SKUs em ERRO_TEMPORARIO. */
export const POST = rotaComParams(async (req, { params }) => {
  const s = await exigirSessao(req);
  const { id } = await params;
  return getDb().withTenant(s.escritorioId, async (c) => {
    const lote = await repos.obterLote(c, id!);
    if (!lote) throw new RespostaHttp(404, "Lote não encontrado");
    if (lote.status !== "EM_REVISAO") throw new RespostaHttp(409, "Só é possível reprocessar um lote em revisão");
    await repos.atualizarLote(c, lote.id, { status: "NA_FILA" });
    await repos.registrarEvento(c, { loteId: lote.id, usuarioId: s.usuarioId, tipo: "lote_reprocessado", dados: {} });
    return jsonResp(200, { ok: true });
  });
});

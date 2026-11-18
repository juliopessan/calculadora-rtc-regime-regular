import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { exigirPapel, exigirSessao, jsonResp, rotaComParams, RespostaHttp } from "@/lib/auth";

const BLOQUEIAM = ["EM_REVISAO", "NA_FILA", "ERRO_TEMPORARIO"] as const;

export const POST = rotaComParams(async (req, { params }) => {
  const s = await exigirSessao(req);
  const { id } = await params;
  return getDb().withTenant(s.escritorioId, async (c) => {
    const lote = await repos.obterLote(c, id!);
    if (!lote) throw new RespostaHttp(404, "Lote não encontrado");
    exigirPapel(s, "contador_responsavel");
    if (lote.status !== "EM_REVISAO") throw new RespostaHttp(409, "O lote não está pronto para assinatura");
    const contagem = await repos.contarPorStatus(c, lote.id);
    const pendentes = BLOQUEIAM.reduce((n, st) => n + (contagem[st] ?? 0), 0);
    if (pendentes > 0) throw new RespostaHttp(409, `Ainda há ${pendentes} SKU(s) pendentes de revisão ou processamento`);
    const concluido = await repos.concluirLote(c, lote.id, s.usuarioId);
    const cobraveis = await repos.contarCobraveis(c, lote.id);
    await repos.registrarEvento(c, { loteId: lote.id, usuarioId: s.usuarioId, tipo: "lote_assinado", dados: { cobraveis, contagem } });
    return jsonResp(200, { id: concluido.id, status: concluido.status, tokenRelatorio: concluido.tokenRelatorio, cobraveis });
  });
});

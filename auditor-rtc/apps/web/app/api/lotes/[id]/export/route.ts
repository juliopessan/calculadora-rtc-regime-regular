import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { exigirSessao, rotaComParams, RespostaHttp } from "@/lib/auth";
import { exportarCsv, paraLinha } from "@/lib/export";

export const GET = rotaComParams(async (req, { params }) => {
  const s = await exigirSessao(req);
  const { id } = await params;
  const { lote, skus } = await getDb().withTenant(s.escritorioId, async (c) => {
    const lote = await repos.obterLote(c, id!);
    if (!lote) throw new RespostaHttp(404, "Lote não encontrado");
    return { lote, skus: await repos.listarSkus(c, lote.id) };
  });
  const nome = `cadastro-${lote.cliente.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-${lote.dataReferencia}.csv`;
  return new Response(exportarCsv(skus.map((x) => paraLinha(x, lote.motorVersao))), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"` },
  });
});

import { repos } from "@auditor/db";
import type { Candidato } from "@auditor/tax-pack";
import { getDb } from "@/lib/db";
import { exigirSessao, jsonResp, lerJson, rotaComParams, RespostaHttp } from "@/lib/auth";

type Corpo = { acao?: "aprovar" | "trocar" | "devolver"; cClassTrib?: string; justificativa?: string };

export const POST = rotaComParams(async (req, { params }) => {
  const s = await exigirSessao(req);
  const { id } = await params;
  const b = await lerJson<Corpo>(req);
  if (!b.acao || !["aprovar", "trocar", "devolver"].includes(b.acao)) throw new RespostaHttp(422, "Ação inválida");

  return getDb().withTenant(s.escritorioId, async (c) => {
    const sku = await repos.obterSku(c, id!);
    if (!sku) throw new RespostaHttp(404, "SKU não encontrado");
    const lote = await repos.obterLote(c, sku.loteId);
    if (lote?.status !== "EM_REVISAO") throw new RespostaHttp(409, "O lote não está em revisão");

    const candidatos = (sku.candidatos ?? []) as Candidato[];
    let patch: Parameters<typeof repos.atualizarSku>[2];
    if (b.acao === "devolver") {
      patch = { status: "PENDENTE_CLIENTE", motivo: b.justificativa?.trim() || "Devolvido ao cliente para conferência", revisadoPor: s.usuarioId };
    } else {
      const codigo = b.acao === "trocar" ? b.cClassTrib : sku.cClassTrib;
      const escolhido = candidatos.find((x) => x.codigo === codigo);
      if (!escolhido) throw new RespostaHttp(422, "cClassTrib fora dos candidatos válidos");
      patch = { status: "CERTIFICADO_REVISADO", cst: escolhido.cst, cClassTrib: escolhido.codigo, revisadoPor: s.usuarioId };
    }
    await repos.atualizarSku(c, sku.id, patch);
    await repos.registrarEvento(c, {
      loteId: sku.loteId,
      skuId: sku.id,
      usuarioId: s.usuarioId,
      tipo: "sku_decidido",
      dados: { acao: b.acao, de: sku.cClassTrib, para: patch.cClassTrib ?? null, justificativa: b.justificativa ?? null },
    });
    return jsonResp(200, { id: sku.id, status: patch.status, cClassTrib: patch.cClassTrib ?? sku.cClassTrib });
  });
});

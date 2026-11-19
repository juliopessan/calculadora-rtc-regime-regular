import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { exigirPapel, exigirSessao, jsonResp, lerJson, rota, RespostaHttp } from "@/lib/auth";
import { estadoCalibracao } from "@/lib/calibracao";

/** Só o contador responsável liga (com o limiar sugerido) ou desliga (null) a certificação automática. */
export const POST = rota(async (req) => {
  const s = await exigirSessao(req);
  exigirPapel(s, "contador_responsavel");
  const b = await lerJson<{ threshold?: number | null }>(req);
  if (b.threshold === undefined) throw new RespostaHttp(422, "Informe o limiar");
  return getDb().withTenant(s.escritorioId, async (c) => {
    const e = await estadoCalibracao(c);
    if (b.threshold !== null && (e.relatorio.threshold === null || b.threshold !== e.relatorio.threshold)) {
      throw new RespostaHttp(422, "Aplique o limiar sugerido pela calibração");
    }
    await repos.aplicarLimiar(c, {
      threshold: b.threshold,
      amostras: e.amostras,
      precisao: e.relatorio.precisionAtThreshold,
      cobertura: e.relatorio.coverageAtThreshold,
      usuarioId: s.usuarioId,
    });
    await repos.registrarEvento(c, { usuarioId: s.usuarioId, tipo: b.threshold === null ? "limiar_desligado" : "limiar_aplicado", dados: { threshold: b.threshold, amostras: e.amostras } });
    return jsonResp(200, { limiarAtual: b.threshold });
  });
});

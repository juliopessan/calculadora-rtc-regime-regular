import { ingerirCsv } from "@auditor/pipeline";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { exigirSessao, jsonResp, rota, RespostaHttp } from "@/lib/auth";

const MAX_BYTES = 10 * 1024 * 1024;

export const GET = rota(async (req) => {
  const s = await exigirSessao(req);
  return jsonResp(200, await getDb().withTenant(s.escritorioId, (c) => repos.listarLotes(c)));
});

export const POST = rota(async (req) => {
  const s = await exigirSessao(req);
  const form = await req.formData().catch(() => {
    throw new RespostaHttp(400, "Envie o formulário com o arquivo");
  });
  const cliente = String(form.get("cliente") ?? "").trim();
  const arquivo = form.get("arquivo");
  const dataReferencia = String(form.get("dataReferencia") || new Date().toISOString().slice(0, 10));
  if (!cliente) throw new RespostaHttp(422, "Informe o nome do cliente");
  const regime = String(form.get("regime") || "regular");
  if (regime !== "regular" && regime !== "simples") throw new RespostaHttp(422, "Regime inválido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataReferencia)) throw new RespostaHttp(422, "Data de referência inválida");
  if (!(arquivo instanceof Blob) || arquivo.size === 0) throw new RespostaHttp(422, "Envie o arquivo CSV do cadastro");
  if (arquivo.size > MAX_BYTES) throw new RespostaHttp(413, "Arquivo maior que 10 MB");

  const ingest = ingerirCsv(new Uint8Array(await arquivo.arrayBuffer()));
  const fatal = ingest.erros.find((e) => e.linha === 0);
  if (fatal) throw new RespostaHttp(422, fatal.motivo);
  if (ingest.skus.length === 0) throw new RespostaHttp(422, "Nenhum SKU válido no arquivo");

  const lote = await getDb().withTenant(s.escritorioId, async (c) => {
    const l = await repos.criarLote(c, { cliente, dataReferencia, skus: ingest.skus, duplicados: ingest.duplicados, regime });
    await repos.registrarEvento(c, { loteId: l.id, usuarioId: s.usuarioId, tipo: "lote_criado", dados: { total: l.total, duplicados: ingest.duplicados, errosLinha: ingest.erros.length } });
    return l;
  });
  return jsonResp(201, { id: lote.id, total: lote.total, duplicados: ingest.duplicados, erros: ingest.erros });
});

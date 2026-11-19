import { repos } from "@auditor/db";
import { getDb } from "./db";
import { fundamentoDe } from "./export";

export type DadosRelatorio = {
  escritorio: { nome: string; corPrimaria: string; logoUrl: string | null };
  lote: { cliente: string; regime: string; dataReferencia: string; motorVersao: string | null; concluidoEm: Date | null; assinadoPor: string | null };
  resumo: { total: number; certificados: number; pendentes: number; naoSuportados: number };
  certificados: { codigo: string; descricao: string; ncm: string; cst: string; cClassTrib: string; fundamento: string }[];
  pendentes: { codigo: string; descricao: string; ncm: string; motivo: string }[];
};

export async function carregarRelatorio(token: string): Promise<DadosRelatorio | null> {
  const db = getDb();
  const ref = await db.resolverTokenRelatorio(token);
  if (!ref) return null;
  return db.withTenant(ref.escritorioId, async (c) => {
    const [esc, lote, skus] = await Promise.all([repos.obterEscritorio(c), repos.obterLote(c, ref.loteId), repos.listarSkus(c, ref.loteId)]);
    if (!lote) return null;
    const cert = skus.filter((s) => s.status === "CERTIFICADO_AUTO" || s.status === "CERTIFICADO_REVISADO");
    const pend = skus.filter((s) => s.status === "PENDENTE_CLIENTE");
    return {
      escritorio: { nome: esc.nome, corPrimaria: esc.corPrimaria, logoUrl: esc.logoUrl },
      lote: { cliente: lote.cliente, regime: lote.regime, dataReferencia: lote.dataReferencia, motorVersao: lote.motorVersao, concluidoEm: lote.concluidoEm, assinadoPor: await repos.nomeUsuario(c, lote.concluidoPor) },
      resumo: { total: lote.total, certificados: cert.length, pendentes: pend.length, naoSuportados: skus.filter((s) => s.status === "NAO_SUPORTADO").length },
      certificados: cert.map((s) => ({ codigo: s.codigo, descricao: s.descricao, ncm: s.ncm ?? s.ncmBruto, cst: s.cst ?? "", cClassTrib: s.cClassTrib ?? "", fundamento: fundamentoDe(s) })),
      pendentes: pend.map((s) => ({ codigo: s.codigo, descricao: s.descricao, ncm: s.ncmBruto, motivo: s.motivo ?? "" })),
    };
  });
}

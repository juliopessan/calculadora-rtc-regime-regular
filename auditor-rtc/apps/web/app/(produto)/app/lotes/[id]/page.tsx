import Link from "next/link";
import { notFound } from "next/navigation";
import { repos, type SkuRow } from "@auditor/db";
import type { Candidato } from "@auditor/tax-pack";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { pct, ROTULO_STATUS_LOTE, ROTULO_STATUS_SKU } from "@/lib/rotulos";
import { FilaRevisao, type ItemFila } from "@/components/fila-revisao";
import { AcoesLote } from "@/components/acoes-lote";

function paraFila(s: SkuRow): ItemFila {
  const cands = (s.candidatos ?? []) as Candidato[];
  const probs = s.probabilidades ?? {};
  const opcoes = cands
    .map((c) => ({ codigo: c.codigo, descricao: c.descricao, tratamento: c.descricaoTratamentoTributario, probabilidade: probs[c.codigo] ?? null }))
    .sort((a, b) => (b.probabilidade ?? -1) - (a.probabilidade ?? -1));
  return { id: s.id, codigo: s.codigo, descricao: s.descricao, ncm: s.ncm, cClassTrib: s.cClassTrib, motivo: s.motivo, opcoes };
}

export default async function LotePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await sessaoOuLogin();
  const { id } = await params;
  const dados = await getDb().withTenant(s.escritorioId, async (c) => {
    const lote = await repos.obterLote(c, id);
    if (!lote) return null;
    return { lote, skus: await repos.listarSkus(c, id), cobraveis: await repos.contarCobraveis(c, id) };
  });
  if (!dados) notFound();
  const { lote, skus, cobraveis } = dados;

  const conta = (st: string) => skus.filter((x) => x.status === st).length;
  const emRevisao = skus.filter((x) => x.status === "EM_REVISAO");
  const temporarios = conta("ERRO_TEMPORARIO");
  const emProcesso = lote.status === "NA_FILA" || lote.status === "PROCESSANDO";
  const aberto = lote.status === "EM_REVISAO";

  return (
    <>
      <p><Link href="/app">← Lotes</Link></p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26 }}>{lote.cliente}</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {ROTULO_STATUS_LOTE[lote.status]} · referência {lote.dataReferencia} · motor {lote.motorVersao ?? "—"} ·
            {lote.threshold === null ? " sem limiar calibrado (tudo passa por revisão)" : ` limiar ${lote.threshold}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a className="btn secundario" href={`/api/lotes/${lote.id}/export`}>Exportar CSV para o ERP</a>
          {lote.tokenRelatorio && <a className="btn" href={`/r/${lote.tokenRelatorio}`} target="_blank" rel="noreferrer">Relatório do cliente</a>}
        </div>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, margin: "20px 0" }}>
        {[
          ["SKUs", String(lote.total)],
          ["Duplicados removidos", String(lote.duplicados)],
          ["Automático", pct(conta("CERTIFICADO_AUTO"), lote.total)],
          ["Em revisão", String(emRevisao.length)],
          ["Pendentes com cliente", String(conta("PENDENTE_CLIENTE"))],
          ["Cobráveis", String(cobraveis)],
        ].map(([k, v]) => (
          <div key={k} className="card" style={{ padding: 16 }}>
            <div className="muted" style={{ fontSize: 13 }}>{k}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div>
          </div>
        ))}
      </section>

      {emProcesso && <p className="card">Processando o lote. Atualize a página em alguns instantes.</p>}

      {aberto && (
        <AcoesLote loteId={lote.id} podeAssinar={s.papel === "contador_responsavel"} podeReprocessar={temporarios > 0} />
      )}

      <h2 style={{ fontSize: 20, marginTop: 28 }}>Fila de revisão ({emRevisao.length})</h2>
      <FilaRevisao itens={emRevisao.map(paraFila)} podeDecidir={aberto} />

      <h2 style={{ fontSize: 20, marginTop: 28 }}>Todos os SKUs</h2>
      <div className="card rolavel" style={{ padding: 0 }}>
        <table className="tabela">
          <thead><tr><th>Código</th><th>Descrição</th><th>NCM</th><th>CST</th><th>cClassTrib</th><th>Confiança</th><th>Status</th><th>Observação</th></tr></thead>
          <tbody>
            {skus.map((x) => {
              const r = ROTULO_STATUS_SKU[x.status]!;
              return (
                <tr key={x.id}>
                  <td>{x.codigo}</td><td>{x.descricao}</td><td>{x.ncm ?? x.ncmBruto}</td><td>{x.cst ?? "—"}</td><td>{x.cClassTrib ?? "—"}</td>
                  <td>{x.confianca === null ? "—" : `${Math.round(x.confianca * 100)}%`}</td>
                  <td><span className={`selo ${r.tom}`}>{r.texto}</span></td>
                  <td className="muted">{x.motivo ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

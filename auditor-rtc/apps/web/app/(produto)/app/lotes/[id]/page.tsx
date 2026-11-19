import Link from "next/link";
import { notFound } from "next/navigation";
import { repos, type SkuRow } from "@auditor/db";
import type { Candidato } from "@auditor/tax-pack";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { pct, ROTULO_STATUS_LOTE } from "@/lib/rotulos";
import { FilaRevisao, type ItemFila } from "@/components/fila-revisao";
import { AcoesLote } from "@/components/acoes-lote";
import { SeloSku } from "@/components/selo";
import { Icone } from "@/components/ledger-icons";

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
  const emProcesso = lote.status === "NA_FILA" || lote.status === "PROCESSANDO";
  const aberto = lote.status === "EM_REVISAO";
  const auto = conta("CERTIFICADO_AUTO");

  return (
    <>
      <p><Link className="link" href="/app"><Icone nome="arrow-left" tamanho={16} />Lotes</Link></p>
      <div className="page-head">
        <div className="stack">
          <h1 className="page-title" tabIndex={-1}>{lote.cliente}</h1>
          <p className="meta">
            {ROTULO_STATUS_LOTE[lote.status]} · referência {lote.dataReferencia} · motor {lote.motorVersao ?? "—"} ·
            {lote.threshold === null ? " sem limiar calibrado (tudo passa por revisão)" : ` limiar ${lote.threshold}`}
          </p>
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <a className="link" href={`/api/lotes/${lote.id}/export`}><Icone nome="download" tamanho={16} />Exportar CSV para o ERP</a>
          {lote.tokenRelatorio && <a className="link" href={`/r/${lote.tokenRelatorio}`} target="_blank" rel="noreferrer">Relatório do cliente <Icone nome="external" tamanho={16} /></a>}
        </div>
      </div>

      <div className="cells cells--4">
        <div className="kpi"><div className="kpi__label">SKUs</div><div className="kpi__n tnum">{lote.total}</div><div className="kpi__delta">Duplicados removidos {lote.duplicados}</div></div>
        <div className="kpi kpi--save"><div className="kpi__label">Automático</div><div className="kpi__n tnum">{pct(auto, lote.total)}</div><div className="kpi__delta">{auto} certificados sem revisão</div><div className="kpi__bar"><i style={{ ["--w" as string]: lote.total ? `${Math.round((auto / lote.total) * 100)}%` : "0%" }} /></div></div>
        <div className="kpi kpi--cost"><div className="kpi__label">Em revisão</div><div className="kpi__n tnum">{emRevisao.length}</div><div className="kpi__delta">Pendentes com cliente {conta("PENDENTE_CLIENTE")}</div></div>
        <div className="kpi"><div className="kpi__label">Cobráveis</div><div className="kpi__n tnum">{cobraveis}</div><div className="kpi__delta">certificados neste lote</div></div>
      </div>

      {emProcesso && (
        <p className="badge" role="status" style={{ marginTop: 24 }}><span className="dot dot--pulse" />Processando o lote. Atualize a página em alguns instantes.</p>
      )}

      {aberto && (
        <div style={{ marginTop: 24 }}>
          <AcoesLote loteId={lote.id} podeAssinar={s.papel === "contador_responsavel"} podeReprocessar={conta("ERRO_TEMPORARIO") > 0} />
        </div>
      )}

      <h2 className="h3" style={{ marginTop: 32, marginBottom: 12 }}>Fila de revisão ({emRevisao.length})</h2>
      <FilaRevisao itens={emRevisao.map(paraFila)} podeDecidir={aberto} />

      <h2 className="h3" style={{ marginTop: 32, marginBottom: 12 }}>Todos os SKUs</h2>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th scope="col">Código</th><th scope="col">Descrição</th><th scope="col">NCM</th><th scope="col">CST</th><th scope="col">cClassTrib</th><th scope="col" className="num">Confiança</th><th scope="col">Status</th><th scope="col">Observação</th></tr></thead>
          <tbody>
            {skus.map((x) => (
              <tr key={x.id}>
                <td className="mono">{x.codigo}</td><td>{x.descricao}</td><td className="mono">{x.ncm ?? x.ncmBruto}</td><td className="mono">{x.cst ?? "—"}</td><td className="mono">{x.cClassTrib ?? "—"}</td>
                <td className="num">{x.confianca === null ? "—" : `${Math.round(x.confianca * 100)}%`}</td>
                <td><SeloSku status={x.status} /></td>
                <td className="soft">{x.motivo ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

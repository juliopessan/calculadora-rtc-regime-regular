import Link from "next/link";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { pct, ROTULO_STATUS_LOTE } from "@/lib/rotulos";
import { Icone } from "@/components/ledger-icons";

export default async function Lotes() {
  const s = await sessaoOuLogin();
  const lotes = await getDb().withTenant(s.escritorioId, (c) => repos.listarLotes(c));
  const total = lotes.reduce((n, l) => n + l.total, 0);
  const emRevisao = lotes.reduce((n, l) => n + l.emRevisao, 0);
  const cobraveis = lotes.reduce((n, l) => n + l.cobraveis, 0);
  const auto = lotes.reduce((n, l) => n + l.auto, 0);
  return (
    <>
      <div className="page-head">
        <div className="stack"><h1 className="page-title" tabIndex={-1}>Lotes</h1><p className="meta">Cadastros enviados pelo escritório</p></div>
        <div className="row"><Link href="/app/lotes/novo" className="btn">Novo lote</Link></div>
      </div>
      {lotes.length === 0 ? (
        <div className="empty">
          <Icone nome="upload" tamanho={32} />
          <h3 className="h3">Nenhum lote ainda</h3>
          <p>Envie o cadastro de um cliente em CSV. Cada SKU é classificado e verificado no motor oficial.</p>
          <Link href="/app/lotes/novo" className="btn">Enviar cadastro</Link>
        </div>
      ) : (
        <>
          <div className="cells cells--4">
            <div className="kpi"><div className="kpi__label">SKUs enviados</div><div className="kpi__n tnum">{total.toLocaleString("pt-BR")}</div><div className="kpi__delta">em {lotes.length} lote(s)</div></div>
            <div className="kpi kpi--save"><div className="kpi__label">Certificados automaticamente</div><div className="kpi__n tnum">{pct(auto, total)}</div><div className="kpi__delta">{auto} de {total} SKUs</div><div className="kpi__bar"><i style={{ ["--w" as string]: total ? `${Math.round((auto / total) * 100)}%` : "0%" }} /></div></div>
            <div className="kpi kpi--cost"><div className="kpi__label">Em revisão</div><div className="kpi__n tnum">{emRevisao}</div><div className="kpi__delta">aguardando o escritório</div></div>
            <div className="kpi"><div className="kpi__label">Cobráveis</div><div className="kpi__n tnum">{cobraveis}</div><div className="kpi__delta">SKUs certificados</div></div>
          </div>
          <div className="tbl-wrap" style={{ marginTop: 24 }}>
            <table className="tbl">
              <thead><tr><th scope="col">Cliente</th><th scope="col">Status</th><th scope="col" className="num">SKUs</th><th scope="col" className="num">% automático</th><th scope="col" className="num">Em revisão</th><th scope="col" className="num">Cobráveis</th><th scope="col">Criado em</th></tr></thead>
              <tbody>
                {lotes.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/app/lotes/${l.id}`}><strong>{l.cliente}</strong></Link></td>
                    <td>{ROTULO_STATUS_LOTE[l.status]}</td>
                    <td className="num">{l.total}</td>
                    <td className="num">{pct(l.auto, l.total)}</td>
                    <td className="num">{l.emRevisao}</td>
                    <td className="num">{l.cobraveis}</td>
                    <td className="mono">{new Date(l.criadoEm).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

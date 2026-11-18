import Link from "next/link";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { pct, ROTULO_STATUS_LOTE } from "@/lib/rotulos";

export default async function Lotes() {
  const s = await sessaoOuLogin();
  const lotes = await getDb().withTenant(s.escritorioId, (c) => repos.listarLotes(c));
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 26 }}>Lotes</h1>
        <Link href="/app/lotes/novo" className="btn">Novo lote</Link>
      </div>
      {lotes.length === 0 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <p style={{ margin: 0 }}>Nenhum lote ainda. Envie o cadastro de um cliente para começar.</p>
        </div>
      ) : (
        <div className="card rolavel" style={{ marginTop: 24, padding: 0 }}>
          <table className="tabela">
            <thead>
              <tr><th>Cliente</th><th>Status</th><th>SKUs</th><th>% automático</th><th>Em revisão</th><th>Certificados (cobráveis)</th><th>Criado em</th></tr>
            </thead>
            <tbody>
              {lotes.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/app/lotes/${l.id}`}>{l.cliente}</Link></td>
                  <td>{ROTULO_STATUS_LOTE[l.status]}</td>
                  <td>{l.total}</td>
                  <td>{pct(l.auto, l.total)}</td>
                  <td>{l.emRevisao}</td>
                  <td>{l.cobraveis}</td>
                  <td>{new Date(l.criadoEm).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

import type { DadosRelatorio } from "@/lib/relatorio";

/** Relatório entregue ao cliente final. Só a marca do escritório aparece. */
export function RelatorioView({ dados }: { dados: DadosRelatorio }) {
  const { escritorio: e, lote: l, resumo: r } = dados;
  return (
    <main className="container relatorio" style={{ ["--brand" as string]: e.corPrimaria, paddingTop: 32, paddingBottom: 48 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: `4px solid ${e.corPrimaria}`, paddingBottom: 16 }}>
        {e.logoUrl && <img src={e.logoUrl} alt={`Logo ${e.nome}`} style={{ maxHeight: 56, maxWidth: 200 }} />}
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, color: e.corPrimaria }}>{e.nome}</div>
          <div className="muted">Revisão de cadastro fiscal para IBS e CBS</div>
        </div>
      </header>

      <section style={{ marginTop: 24 }}>
        <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>Cliente: {l.cliente}</h1>
        <p className="muted" style={{ margin: 0 }}>
          Data de referência {l.dataReferencia} · Motor de cálculo versão {l.motorVersao ?? "—"}
          {l.assinadoPor && <> · Assinado por {l.assinadoPor}</>}
          {l.concluidoEm && <> em {new Date(l.concluidoEm).toLocaleDateString("pt-BR")}</>}
        </p>
        <p>
          <b>{r.certificados}</b> de <b>{r.total}</b> produtos certificados · <b>{r.pendentes}</b> pendentes de informação · <b>{r.naoSuportados}</b> fora do escopo
        </p>
      </section>

      <h2 style={{ fontSize: 18 }}>Produtos certificados</h2>
      <div className="rolavel">
        <table className="tabela">
          <thead><tr><th>Código</th><th>Produto</th><th>NCM</th><th>CST</th><th>cClassTrib</th><th>Fundamento</th></tr></thead>
          <tbody>
            {dados.certificados.map((s) => (
              <tr key={s.codigo}><td>{s.codigo}</td><td>{s.descricao}</td><td>{s.ncm}</td><td>{s.cst}</td><td>{s.cClassTrib}</td><td style={{ fontSize: 12 }}>{s.fundamento}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados.pendentes.length > 0 && (
        <>
          <h2 style={{ fontSize: 18 }}>Precisamos de informação sobre estes produtos</h2>
          <div className="rolavel">
            <table className="tabela">
              <thead><tr><th>Código</th><th>Produto</th><th>NCM informado</th><th>O que falta</th></tr></thead>
              <tbody>{dados.pendentes.map((s) => <tr key={s.codigo}><td>{s.codigo}</td><td>{s.descricao}</td><td>{s.ncm}</td><td>{s.motivo}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}

      <footer className="muted" style={{ marginTop: 32, fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        Classificação verificada com o motor de cálculo de código aberto da Receita Federal (licença MIT). O uso do motor
        não implica endosso da Receita Federal do Brasil. A classificação foi aprovada pelo profissional responsável de {e.nome}.
      </footer>
    </main>
  );
}

import type { DadosRelatorio } from "@/lib/relatorio";
import { ROTULO_REGIME } from "@/lib/rotulos";

/** Relatório entregue ao cliente final. Só a marca do escritório aparece. */
export function RelatorioView({ dados }: { dados: DadosRelatorio }) {
  const { escritorio: e, lote: l, resumo: r } = dados;
  return (
    <main className="rel" style={{ ["--marca" as string]: e.corPrimaria }}>
      <header className="rel-cab">
        {e.logoUrl && <img src={e.logoUrl} alt={`Logo ${e.nome}`} />}
        <div>
          <div className="rel-nome" style={{ color: e.corPrimaria }}>{e.nome}</div>
          <div className="rel-suave">Revisão de cadastro fiscal para IBS e CBS</div>
        </div>
      </header>

      <section>
        <h1>Cliente: {l.cliente}</h1>
        <p className="rel-suave" style={{ margin: 0 }}>
          Regime: {ROTULO_REGIME[l.regime] ?? "Regime regular"} · Data de referência {l.dataReferencia} · Motor de cálculo versão {l.motorVersao ?? "—"}
          {l.assinadoPor && <> · Assinado por {l.assinadoPor}</>}
          {l.concluidoEm && <> em {new Date(l.concluidoEm).toLocaleDateString("pt-BR")}</>}
        </p>
        <p>
          <b>{r.certificados}</b> de <b>{r.total}</b> produtos certificados · <b>{r.pendentes}</b> pendentes de informação · <b>{r.naoSuportados}</b> fora do escopo
        </p>
      </section>

      <h2>Produtos certificados</h2>
      <div className="rel-rolavel">
        <table className="rel-tabela">
          <thead><tr><th>Código</th><th>Produto</th><th>NCM</th><th>CST</th><th>cClassTrib</th><th>Fundamento</th></tr></thead>
          <tbody>
            {dados.certificados.map((s) => (
              <tr key={s.codigo}><td>{s.codigo}</td><td>{s.descricao}</td><td>{s.ncm}</td><td>{s.cst}</td><td>{s.cClassTrib}</td><td className="rel-fund">{s.fundamento}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {dados.pendentes.length > 0 && (
        <>
          <h2>Precisamos de informação sobre estes produtos</h2>
          <div className="rel-rolavel">
            <table className="rel-tabela">
              <thead><tr><th>Código</th><th>Produto</th><th>NCM informado</th><th>O que falta</th></tr></thead>
              <tbody>{dados.pendentes.map((s) => <tr key={s.codigo}><td>{s.codigo}</td><td>{s.descricao}</td><td>{s.ncm}</td><td>{s.motivo}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}

      <footer className="rel-rodape">
        Classificação verificada com o motor de cálculo de código aberto da Receita Federal (licença MIT). O uso do motor
        não implica endosso da Receita Federal do Brasil. A classificação foi aprovada pelo profissional responsável de {e.nome}.
      </footer>
    </main>
  );
}

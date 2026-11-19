/** Proof Panel compacto das telas de acesso: dado público, com a fonte declarada. */
export function PainelAuth() {
  return (
    <aside className="auth__aside">
      <div className="panel" aria-label="Dado do mercado sobre cadastros">
        <div className="panel__head"><span className="dot dot--pulse" /><span className="title">Cadastros no regime normal</span><span className="meta">jul/2026</span></div>
        <div className="stats" style={{ borderTop: 0 }}>
          <div><div className="stat__n">93%</div><div className="stat__l">com inconsistência</div></div>
          <div><div className="stat__n">2,5 mi</div><div className="stat__l">produtos analisados</div></div>
        </div>
        <p className="note"><span className="flag" aria-hidden="true">✓</span><span>Fonte: levantamento IOB, julho de 2026. Não é dado deste produto.</span></p>
      </div>
    </aside>
  );
}

import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { estadoCalibracao } from "@/lib/calibracao";
import { AcaoLimiar } from "@/components/acao-limiar";
import { Icone } from "@/components/ledger-icons";

const p = (x: number) => `${(x * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function Calibracao() {
  const s = await sessaoOuLogin();
  const e = await getDb().withTenant(s.escritorioId, (c) => estadoCalibracao(c));
  const faltam = Math.max(0, e.minimo - e.amostras);
  const progresso = Math.min(100, Math.round((e.amostras / e.minimo) * 100));
  const r = e.relatorio;
  return (
    <>
      <div className="page-head">
        <div className="stack"><h1 className="page-title" tabIndex={-1}>Calibração</h1><p className="meta">Quando confiar no modelo sem revisão humana</p></div>
        {s.papel === "contador_responsavel" && <AcaoLimiar sugerido={r.threshold} atual={e.limiarAtual} />}
      </div>

      <div className="cells cells--4">
        <div className="kpi"><div className="kpi__label">Amostras revisadas</div><div className="kpi__n tnum">{e.amostras} de {e.minimo}</div><div className="kpi__delta">{faltam > 0 ? `faltam ${faltam} para calibrar` : "mínimo atingido"}</div><div className="kpi__bar"><i style={{ ["--w" as string]: `${progresso}%` }} /></div></div>
        <div className="kpi"><div className="kpi__label">Limiar sugerido</div><div className="kpi__n tnum">{r.threshold ?? "—"}</div><div className="kpi__delta">para {p(e.alvo)} de precisão</div></div>
        <div className="kpi kpi--save"><div className="kpi__label">Precisão no limiar</div><div className="kpi__n tnum">{r.threshold === null ? "—" : p(r.precisionAtThreshold)}</div><div className="kpi__delta">acertos entre os auto-aprovados</div></div>
        <div className="kpi"><div className="kpi__label">Cobertura</div><div className="kpi__n tnum">{r.threshold === null ? "—" : p(r.coverageAtThreshold)}</div><div className="kpi__delta">SKUs que dispensariam revisão</div></div>
      </div>

      <div className="block" style={{ marginTop: 24 }}>
        <div className="block__head"><h2 className="h3">Limiar em uso</h2><span className="badge">{e.limiarAtual === null ? "desligado" : `limiar ${e.limiarAtual}`}</span></div>
        <div className="block__body">
          <p style={{ margin: 0 }}>
            {e.limiarAtual === null
              ? "Todos os SKUs passam por revisão humana. Lotes novos herdam o limiar quando o contador responsável aplicar um."
              : `Lotes novos certificam automaticamente quando a confiança do modelo é ${e.limiarAtual} ou mais e o motor oficial confirma.`}
          </p>
          {s.papel !== "contador_responsavel" && <p className="hint" style={{ marginBottom: 0 }}>Só o contador responsável aplica ou desliga o limiar.</p>}
        </div>
      </div>

      <div className="block" style={{ marginTop: 24 }}>
        <div className="block__head"><h2 className="h3">Precisão por faixa de confiança</h2><span className="meta">rótulo = decisão final do revisor</span></div>
        {e.amostras === 0 ? (
          <div className="block__body">
            <div className="empty"><Icone nome="meter" tamanho={32} /><h3 className="h3">Nenhuma amostra ainda</h3><p>Cada SKU que o modelo sugeriu e o seu time revisou vira uma amostra. Revise lotes normalmente para chegar a {e.minimo}.</p></div>
          </div>
        ) : (
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="tbl">
              <thead><tr><th scope="col">Confiança</th><th scope="col" className="num">Amostras</th><th scope="col" className="num">Precisão</th></tr></thead>
              <tbody>
                {r.buckets.filter((b) => b.n > 0).reverse().map((b) => (
                  <tr key={b.lo}><td className="mono">{b.lo.toFixed(1)} a {b.hi.toFixed(1)}</td><td className="num">{b.n}</td><td className="num">{p(b.precision)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="hint" style={{ marginTop: 16 }}>SKUs certificados automaticamente não entram como amostra, para o modelo não confirmar a si mesmo.</p>
    </>
  );
}

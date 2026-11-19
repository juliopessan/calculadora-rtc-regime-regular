"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./ledger-icons";

export type ItemFila = {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string | null;
  cClassTrib: string | null;
  motivo: string | null;
  opcoes: { codigo: string; descricao: string; tratamento: string; probabilidade: number | null }[];
};

export function FilaRevisao({ itens, podeDecidir }: { itens: ItemFila[]; podeDecidir: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(id: string, corpo: Record<string, string>) {
    setOcupado(id);
    setErro(null);
    const res = await fetch(`/api/skus/${id}/decisao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
    setOcupado(null);
    if (!res?.ok) return setErro(res ? (((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "A decisão não foi salva.") : "Sem conexão com o servidor. Tente de novo.");
    router.refresh();
  }

  if (itens.length === 0) {
    return <div className="empty"><Icone nome="check" tamanho={32} /><h3 className="h3">Nada para revisar</h3><p>Todos os SKUs deste lote já têm decisão.</p></div>;
  }
  return (
    <div className="gstack">
      {erro && <p className="field-error" role="alert" style={{ display: "flex" }}><Icone nome="error" tamanho={16} /><span>{erro}</span></p>}
      {itens.map((it) => (
        <div key={it.id} className="block">
          <div className="block__head">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><strong>{it.descricao}</strong><span className="meta">Código {it.codigo} · NCM {it.ncm ?? "—"}{it.motivo ? ` · ${it.motivo}` : ""}</span></div>
          </div>
          <div className="tbl-wrap" style={{ border: 0 }}>
            <table className="tbl">
              <thead><tr><th scope="col">cClassTrib</th><th scope="col">Tratamento</th><th scope="col" className="num">Probabilidade</th></tr></thead>
              <tbody>
                {it.opcoes.slice(0, 3).map((o) => (
                  <tr key={o.codigo}>
                    <td className="mono">{o.codigo}{o.codigo === it.cClassTrib ? " · sugerido" : ""}</td>
                    <td>{o.descricao}<div className="hint">{o.tratamento}</div></td>
                    <td className="num">{o.probabilidade === null ? "—" : `${Math.round(o.probabilidade * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {podeDecidir && (
            <form
              className="block__body row" style={{ flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                decidir(it.id, { acao: "trocar", cClassTrib: String(f.get("cClassTrib")), justificativa: String(f.get("justificativa") ?? "") });
              }}
            >
              {it.cClassTrib && (
                <button type="button" className="btn btn--sm" disabled={ocupado === it.id} onClick={() => decidir(it.id, { acao: "aprovar" })}>Aprovar {it.cClassTrib}</button>
              )}
              <select className="select input" name="cClassTrib" aria-label="Trocar classificação" defaultValue={it.cClassTrib ?? it.opcoes[0]?.codigo} style={{ maxWidth: 320 }}>
                {it.opcoes.map((o) => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.descricao.slice(0, 60)}</option>)}
              </select>
              <input className="input" name="justificativa" placeholder="Justificativa (opcional)" aria-label="Justificativa" style={{ maxWidth: 260 }} />
              <button type="submit" className="btn btn--line btn--sm" disabled={ocupado === it.id}>Trocar</button>
              <button type="button" className="btn btn--line btn--sm" disabled={ocupado === it.id} onClick={() => decidir(it.id, { acao: "devolver" })}>Devolver ao cliente</button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

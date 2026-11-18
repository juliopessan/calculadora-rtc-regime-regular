"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    const res = await fetch(`/api/skus/${id}/decisao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
    setOcupado(null);
    if (!res.ok) return setErro(((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "Falha ao salvar a decisão");
    router.refresh();
  }

  if (itens.length === 0) return <p className="muted">Nada para revisar.</p>;
  return (
    <>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
        {itens.map((it) => (
          <li key={it.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>{it.descricao}</strong>
                <div className="muted" style={{ fontSize: 13 }}>Código {it.codigo} · NCM {it.ncm ?? "—"}{it.motivo ? ` · ${it.motivo}` : ""}</div>
              </div>
            </div>
            <table className="tabela" style={{ marginTop: 8 }}>
              <thead><tr><th>cClassTrib</th><th>Tratamento</th><th>Probabilidade</th></tr></thead>
              <tbody>
                {it.opcoes.slice(0, 3).map((o) => (
                  <tr key={o.codigo} style={o.codigo === it.cClassTrib ? { fontWeight: 600 } : undefined}>
                    <td>{o.codigo}{o.codigo === it.cClassTrib ? " (sugerido)" : ""}</td>
                    <td>{o.descricao}<div className="muted" style={{ fontSize: 12 }}>{o.tratamento}</div></td>
                    <td>{o.probabilidade === null ? "—" : `${Math.round(o.probabilidade * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {podeDecidir && (
              <form
                style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  decidir(it.id, { acao: "trocar", cClassTrib: String(f.get("cClassTrib")), justificativa: String(f.get("justificativa") ?? "") });
                }}
              >
                {it.cClassTrib && (
                  <button type="button" className="btn" disabled={ocupado === it.id} onClick={() => decidir(it.id, { acao: "aprovar" })}>
                    Aprovar {it.cClassTrib}
                  </button>
                )}
                <select name="cClassTrib" aria-label="Trocar classificação" defaultValue={it.cClassTrib ?? it.opcoes[0]?.codigo}>
                  {it.opcoes.map((o) => <option key={o.codigo} value={o.codigo}>{o.codigo} — {o.descricao.slice(0, 60)}</option>)}
                </select>
                <input name="justificativa" placeholder="Justificativa (opcional)" aria-label="Justificativa" />
                <button type="submit" className="btn secundario" disabled={ocupado === it.id}>Trocar</button>
                <button type="button" className="btn secundario" disabled={ocupado === it.id} onClick={() => decidir(it.id, { acao: "devolver" })}>
                  Devolver ao cliente
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

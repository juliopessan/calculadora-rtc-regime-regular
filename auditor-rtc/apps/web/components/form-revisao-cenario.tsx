"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./ledger-icons";

export type LinhaCenario = { codigo: string; descricao: string; motivo: string };

export function FormRevisaoCenario({ permitidos, excluidos, podeAssinar }: { permitidos: LinhaCenario[]; excluidos: LinhaCenario[]; podeAssinar: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const f = new FormData(e.currentTarget);
    const faltando = permitidos.filter((p) => !f.get(`d-${p.codigo}`));
    if (faltando.length > 0) {
      setErro(`Marque concordo ou discordo em ${faltando.length} código(s) para assinar.`);
      document.querySelector<HTMLInputElement>(`input[name="d-${faltando[0]!.codigo}"]`)?.focus();
      return;
    }
    const itens = permitidos.map((p) => ({ codigo: p.codigo, decisao: String(f.get(`d-${p.codigo}`)), comentario: String(f.get(`c-${p.codigo}`) ?? "") }));
    const sugeridos = excluidos.filter((x) => f.get(`s-${x.codigo}`)).map((x) => x.codigo);
    const res = await fetch("/api/cenario/revisao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itens, sugeridos }) }).catch(() => null);
    if (!res?.ok) return setErro(res ? (((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "A revisão não foi assinada.") : "Sem conexão com o servidor.");
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} noValidate className="gstack">
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th scope="col">cClassTrib</th><th scope="col">Classificação</th><th scope="col">Por que está no cenário</th><th scope="col">Sua decisão</th><th scope="col">Comentário</th></tr></thead>
          <tbody>
            {permitidos.map((p) => (
              <tr key={p.codigo}>
                <td className="mono">{p.codigo}</td><td>{p.descricao}</td><td className="soft">{p.motivo}</td>
                <td>
                  <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: 12 }} disabled={!podeAssinar}>
                    <legend className="sr-only">Decisão sobre {p.codigo}</legend>
                    <label className="check"><input type="radio" name={`d-${p.codigo}`} value="concordo" /> Concordo</label>
                    <label className="check"><input type="radio" name={`d-${p.codigo}`} value="discordo" /> Discordo</label>
                  </fieldset>
                </td>
                <td><input className="input" name={`c-${p.codigo}`} aria-label={`Comentário sobre ${p.codigo}`} disabled={!podeAssinar} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="block">
        <summary className="block__head" style={{ cursor: "pointer" }}><h2 className="h3">Excluídos do cenário ({excluidos.length})</h2><Icone nome="chevron-down" /></summary>
        <div className="block__body">
          <p className="hint">Dependem do comprador, do vendedor ou do tipo de operação. Marque os que deveriam ser decididos só pelo produto.</p>
          {excluidos.length === 0 ? <p className="soft">Lista do motor indisponível agora.</p> : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {excluidos.map((x) => (
                <li key={x.codigo}><label className="check"><input type="checkbox" name={`s-${x.codigo}`} disabled={!podeAssinar} /> <span className="mono">{x.codigo}</span> — {x.descricao}</label></li>
              ))}
            </ul>
          )}
        </div>
      </details>

      {erro && <p className="field-error" role="alert" style={{ display: "flex" }}><Icone nome="error" tamanho={16} /><span>{erro}</span></p>}
      {ok && <p className="badge badge--ok" role="status"><Icone nome="success" />Revisão assinada</p>}
      {podeAssinar
        ? <div className="row"><button className="btn" type="submit">Assinar revisão</button></div>
        : <p className="hint">Só o contador responsável assina a revisão do cenário.</p>}
    </form>
  );
}

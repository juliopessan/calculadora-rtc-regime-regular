"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./ledger-icons";

type Campo = { nome: string; rotulo: string; tipo?: string; autoComplete?: string; minLength?: number; inputMode?: "email" | "text"; dica?: string };

export function FormAuth({ endpoint, campos, botao, ocupado }: { endpoint: string; campos: Campo[]; botao: string; ocupado: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const dados = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) }).catch(() => null);
    setEnviando(false);
    if (res?.ok) return router.push("/app");
    setErro(res ? (((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "Não foi possível continuar.") : "Sem conexão com o servidor. Tente de novo.");
  }

  return (
    <form onSubmit={enviar} noValidate className="gstack" style={{ gap: 16 }}>
      {campos.map((c) => (
        <div className="field" key={c.nome}>
          <label htmlFor={c.nome}>{c.rotulo}</label>
          <input
            className="input" id={c.nome} name={c.nome} type={c.tipo ?? "text"} autoComplete={c.autoComplete} minLength={c.minLength}
            inputMode={c.inputMode} autoCapitalize={c.tipo === "email" ? "none" : undefined} spellCheck={c.tipo === "email" ? false : undefined} required
          />
          {c.dica && <p className="hint">{c.dica}</p>}
        </div>
      ))}
      {erro && (
        <p className="field-error" role="alert" style={{ display: "flex" }}>
          <Icone nome="error" tamanho={16} /><span>{erro}</span>
        </p>
      )}
      <button className="btn btn--block" type="submit" disabled={enviando} aria-busy={enviando}>{enviando ? ocupado : botao}</button>
    </form>
  );
}

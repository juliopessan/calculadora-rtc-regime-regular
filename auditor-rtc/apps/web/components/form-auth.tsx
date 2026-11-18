"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Campo = { nome: string; rotulo: string; tipo?: string; autoComplete?: string; minLength?: number };

export function FormAuth({ endpoint, campos, botao }: { endpoint: string; campos: Campo[]; botao: string }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const dados = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados) });
    setEnviando(false);
    if (res.ok) return router.push("/app");
    setErro(((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "Não foi possível continuar");
  }

  return (
    <form onSubmit={enviar} noValidate>
      {campos.map((c) => (
        <div className="campo" key={c.nome}>
          <label htmlFor={c.nome}>{c.rotulo}</label>
          <input id={c.nome} name={c.nome} type={c.tipo ?? "text"} autoComplete={c.autoComplete} minLength={c.minLength} required />
        </div>
      ))}
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button className="btn" type="submit" disabled={enviando} style={{ width: "100%" }}>
        {enviando ? "Aguarde..." : botao}
      </button>
    </form>
  );
}

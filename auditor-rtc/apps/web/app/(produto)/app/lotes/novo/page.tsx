"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NovoLote() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await fetch("/api/lotes", { method: "POST", body: new FormData(e.currentTarget) });
    const body = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) return setErro(body.erro ?? "Não foi possível criar o lote");
    router.push(`/app/lotes/${body.id}`);
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1 style={{ marginTop: 0, fontSize: 24 }}>Novo lote</h1>
      <p className="muted">CSV exportado do ERP com as colunas <b>descrição</b> e <b>NCM</b> (código e GTIN são opcionais). Aceita ";" ou "," e acentos.</p>
      <form onSubmit={enviar}>
        <div className="campo"><label htmlFor="cliente">Cliente</label><input id="cliente" name="cliente" required /></div>
        <div className="campo"><label htmlFor="dataReferencia">Data de referência</label><input id="dataReferencia" name="dataReferencia" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
        <div className="campo"><label htmlFor="arquivo">Arquivo do cadastro (CSV, até 10 MB)</label><input id="arquivo" name="arquivo" type="file" accept=".csv,text/csv" required /></div>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button className="btn" type="submit" disabled={enviando}>{enviando ? "Enviando..." : "Enviar para processamento"}</button>
      </form>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "@/components/ledger-icons";

export default function NovoLote() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const res = await fetch("/api/lotes", { method: "POST", body: new FormData(e.currentTarget) }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!res?.ok) return setErro(body.erro ?? "Sem conexão com o servidor. Tente de novo.");
    router.push(`/app/lotes/${body.id}`);
  }

  return (
    <>
      <div className="page-head"><div className="stack"><h1 className="page-title" tabIndex={-1}>Novo lote</h1><p className="meta">CSV do ERP com as colunas descrição e NCM; código e GTIN são opcionais</p></div></div>
      <div className="block" style={{ maxWidth: 640 }}>
        <div className="block__body">
          <form onSubmit={enviar} className="gstack" style={{ gap: 16 }} noValidate>
            <div className="field"><label htmlFor="cliente">Cliente</label><input className="input" id="cliente" name="cliente" required /></div>
            <div className="field">
              <label htmlFor="regime">Regime do cliente</label>
              <select className="select input" id="regime" name="regime" defaultValue="regular">
                <option value="regular">Regime regular</option>
                <option value="simples">Simples Nacional</option>
              </select>
              <p className="hint">Fica registrado no lote e no relatório. A classificação do produto é a mesma nos dois regimes.</p>
            </div>
            <div className="field"><label htmlFor="dataReferencia">Data de referência</label><input className="input" id="dataReferencia" name="dataReferencia" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
            <div className="field"><label htmlFor="arquivo">Arquivo do cadastro (CSV, até 10 MB)</label><input className="input" id="arquivo" name="arquivo" type="file" accept=".csv,text/csv" required /><p className="hint">Aceita ";" ou "," e acentos (UTF-8 ou Latin-1).</p></div>
            {erro && <p className="field-error" role="alert" style={{ display: "flex" }}><Icone nome="error" tamanho={16} /><span>{erro}</span></p>}
            <div className="row"><button className="btn" type="submit" disabled={enviando} aria-busy={enviando}>{enviando ? "Enviando..." : "Enviar para processamento"}</button></div>
          </form>
        </div>
      </div>
    </>
  );
}

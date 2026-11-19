"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./ledger-icons";

export function AcaoLimiar({ sugerido, atual }: { sugerido: number | null; atual: number | null }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  async function aplicar(threshold: number | null) {
    setErro(null);
    const res = await fetch("/api/calibracao/aplicar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threshold }) }).catch(() => null);
    if (!res?.ok) return setErro(res ? (((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "O limiar não foi aplicado.") : "Sem conexão com o servidor.");
    router.refresh();
  }
  return (
    <div className="row" style={{ flexWrap: "wrap" }}>
      {sugerido !== null && sugerido !== atual && <button className="btn" type="button" onClick={() => aplicar(sugerido)}>Aplicar limiar {sugerido}</button>}
      {atual !== null && <button className="btn btn--line" type="button" onClick={() => aplicar(null)}>Desligar certificação automática</button>}
      {erro && <p className="field-error" role="alert" style={{ display: "flex", margin: 0 }}><Icone nome="error" tamanho={16} /><span>{erro}</span></p>}
    </div>
  );
}

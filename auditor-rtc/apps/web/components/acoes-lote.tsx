"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AcoesLote({ loteId, podeAssinar, podeReprocessar }: { loteId: string; podeAssinar: boolean; podeReprocessar: boolean }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  async function post(path: string) {
    setErro(null);
    const res = await fetch(`/api/lotes/${loteId}/${path}`, { method: "POST" });
    if (!res.ok) return setErro(((await res.json().catch(() => ({}))) as { erro?: string }).erro ?? "Falha");
    router.refresh();
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {podeReprocessar && <button className="btn secundario" onClick={() => post("reprocessar")}>Reprocessar erros temporários</button>}
      {podeAssinar && <button className="btn" onClick={() => post("concluir")}>Concluir e assinar lote</button>}
      {erro && <span className="erro" role="alert" style={{ margin: 0 }}>{erro}</span>}
    </div>
  );
}

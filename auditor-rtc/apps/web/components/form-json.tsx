"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Formulário genérico que envia JSON e atualiza a página. */
export function FormJson({ endpoint, botao, children, limparAoEnviar = false }: { endpoint: string; botao: string; children: React.ReactNode; limparAoEnviar?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
        const body = (await res.json().catch(() => ({}))) as { erro?: string };
        setMsg(res.ok ? { ok: true, texto: "Salvo." } : { ok: false, texto: body.erro ?? "Falha ao salvar" });
        if (res.ok) {
          if (limparAoEnviar) form.reset();
          router.refresh();
        }
      }}
    >
      {children}
      {msg && <p className={msg.ok ? "muted" : "erro"} role="status">{msg.texto}</p>}
      <button className="btn" type="submit">{botao}</button>
    </form>
  );
}

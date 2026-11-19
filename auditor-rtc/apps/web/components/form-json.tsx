"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone } from "./ledger-icons";

/** Formulário que envia JSON; mensagem de sucesso nomeia a ação concluída. */
export function FormJson({ endpoint, botao, feito, children, limparAoEnviar = false }: { endpoint: string; botao: string; feito: string; children: React.ReactNode; limparAoEnviar?: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <form
      className="gstack" style={{ gap: 16 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) }).catch(() => null);
        const body = res ? ((await res.json().catch(() => ({}))) as { erro?: string }) : { erro: "Sem conexão com o servidor. Tente de novo." };
        setMsg(res?.ok ? { ok: true, texto: feito } : { ok: false, texto: body.erro ?? "Não foi possível salvar." });
        if (res?.ok) {
          if (limparAoEnviar) form.reset();
          router.refresh();
        }
      }}
    >
      {children}
      {msg && (msg.ok
        ? <p className="badge badge--ok" role="status"><Icone nome="success" />{msg.texto}</p>
        : <p className="field-error" role="alert" style={{ display: "flex" }}><Icone nome="error" tamanho={16} /><span>{msg.texto}</span></p>)}
      <div className="row"><button className="btn" type="submit">{botao}</button></div>
    </form>
  );
}

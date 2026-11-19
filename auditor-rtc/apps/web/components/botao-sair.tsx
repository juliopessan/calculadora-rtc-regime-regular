"use client";
import { useRouter } from "next/navigation";
import { Icone } from "./ledger-icons";

export function BotaoSair() {
  const router = useRouter();
  return (
    <button className="link" type="button" style={{ padding: "8px 12px", textDecoration: "none", fontWeight: 400 }}
      onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>
      <Icone nome="logout" />Sair
    </button>
  );
}

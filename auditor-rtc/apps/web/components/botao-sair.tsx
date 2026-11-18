"use client";
import { useRouter } from "next/navigation";

export function BotaoSair() {
  const router = useRouter();
  return (
    <button className="btn secundario" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>
      Sair
    </button>
  );
}

import Link from "next/link";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { ROTULO_PAPEL } from "@/lib/rotulos";
import { BotaoSair } from "@/components/botao-sair";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await sessaoOuLogin();
  const esc = await getDb().withTenant(s.escritorioId, (c) => repos.obterEscritorio(c));
  return (
    <div style={{ ["--brand" as string]: esc.corPrimaria }}>
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <nav className="container" aria-label="Aplicativo" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", padding: "12px 16px" }}>
          <strong style={{ marginRight: "auto" }}>{esc.nome}</strong>
          <Link href="/app">Lotes</Link>
          <Link href="/app/lotes/novo">Novo lote</Link>
          {s.papel === "socio" && <Link href="/app/equipe">Equipe</Link>}
          {s.papel === "socio" && <Link href="/app/marca">Marca</Link>}
          <span className="muted" style={{ fontSize: 14 }}>{s.nome} · {ROTULO_PAPEL[s.papel]}</span>
          <BotaoSair />
        </nav>
      </header>
      <main className="container" style={{ paddingTop: 24, paddingBottom: 48 }}>{children}</main>
    </div>
  );
}

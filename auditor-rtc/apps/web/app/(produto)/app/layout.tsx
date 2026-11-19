import Link from "next/link";
import { repos } from "@auditor/db";
import { getDb } from "@/lib/db";
import { sessaoOuLogin } from "@/lib/server-session";
import { iniciais, ROTULO_PAPEL } from "@/lib/rotulos";
import { BotaoSair } from "@/components/botao-sair";
import { NavLateral, type ItemNav } from "@/components/nav-lateral";
import { Icone } from "@/components/ledger-icons";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await sessaoOuLogin();
  const esc = await getDb().withTenant(s.escritorioId, (c) => repos.obterEscritorio(c));
  const itens: ItemNav[] = [
    { href: "/app", rotulo: "Lotes", icone: "layers" },
    { href: "/app/lotes/novo", rotulo: "Novo lote", icone: "upload" },
    { href: "/app/calibracao", rotulo: "Calibração", icone: "meter" },
    { href: "/app/cenario", rotulo: "Cenário", icone: "shield" },
    ...(s.papel === "socio"
      ? [{ href: "/app/equipe", rotulo: "Equipe", icone: "users" }, { href: "/app/marca", rotulo: "Marca", icone: "settings" }]
      : []),
  ];
  return (
    <div className="shell">
      <aside className="side" id="side" aria-label="Escritório">
        <Link className="brand" href="/app" aria-label="Auditor RTC, lotes"><span className="brand__mark">A</span><span className="brand__name">Auditor RTC</span></Link>
        <NavLateral itens={itens} />
        <div className="side__foot"><BotaoSair /></div>
      </aside>
      <div className="shell__scrim" />
      <div>
        <header className="top">
          <button className="icon-btn" type="button" data-nav-toggle aria-label="Abrir menu" aria-expanded="false" aria-controls="side"><Icone nome="menu" /></button>
          <span className="meta">{esc.nome}</span><span className="top__spacer" />
          <span className="meta">{s.nome} · {ROTULO_PAPEL[s.papel]}</span>
          <button className="icon-btn" type="button" data-theme-toggle aria-label="Tema: automático. Mudar tema"><Icone nome="contrast" /></button>
          <span className="tile tile--ink" title={s.nome} aria-label={`Conectado como ${s.nome}`}>{iniciais(s.nome)}</span>
        </header>
        <main className="main" id="conteudo">{children}</main>
      </div>
    </div>
  );
}

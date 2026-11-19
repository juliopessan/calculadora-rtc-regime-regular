"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone } from "./ledger-icons";

export type ItemNav = { href: string; rotulo: string; icone: string };

export function NavLateral({ itens }: { itens: ItemNav[] }) {
  const path = usePathname();
  return (
    <nav className="side__nav" aria-label="Aplicativo">
      {itens.map((i) => {
        const atual = i.href === "/app" ? path === "/app" || path.startsWith("/app/lotes/") && !path.endsWith("/novo") : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={atual ? "page" : undefined}><Icone nome={i.icone} />{i.rotulo}</Link>
        );
      })}
    </nav>
  );
}

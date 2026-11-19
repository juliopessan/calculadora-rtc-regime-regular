import Script from "next/script";
import "./ledger.css";
import { LedgerIcons } from "@/components/ledger-icons";
import { LedgerRefresh } from "@/components/ledger-refresh";

const FONTES = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=Instrument+Serif:ital@1&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

export default function ProdutoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={FONTES} precedence="default" />
      <meta name="theme-color" content="#F1EEE5" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#151310" media="(prefers-color-scheme: dark)" />
      <div className="progress" aria-hidden="true" />
      <a className="skip" href="#conteudo">Pular para o conteúdo</a>
      <LedgerIcons />
      <div id="toasts" role="status" aria-live="polite" />
      {children}
      <LedgerRefresh />
      <Script src="/ledger.js" strategy="afterInteractive" />
    </>
  );
}

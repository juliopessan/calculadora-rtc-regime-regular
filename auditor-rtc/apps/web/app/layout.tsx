import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auditor RTC",
  description: "Revisão de cadastro para a Reforma Tributária, com a marca do seu escritório.",
};

// Raiz mínima: o produto carrega a Ledger em (produto)/layout; o relatório white-label tem CSS próprio.
const THEME_BOOT = `document.documentElement.classList.add('js');try{var t=localStorage.getItem('ledger-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

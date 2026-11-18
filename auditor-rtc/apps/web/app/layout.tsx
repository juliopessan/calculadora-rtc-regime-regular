import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Auditor RTC",
  description: "Revisão de cadastro para a Reforma Tributária, com a marca do seu escritório.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

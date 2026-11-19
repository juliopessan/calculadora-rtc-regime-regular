import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { carregarRelatorio } from "@/lib/relatorio";
import { RelatorioView } from "@/components/relatorio-view";
import "./relatorio.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relatório de cadastro fiscal", robots: { index: false, follow: false } };

export default async function Relatorio({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const dados = await carregarRelatorio(token);
  if (!dados) notFound();
  return <RelatorioView dados={dados} />;
}

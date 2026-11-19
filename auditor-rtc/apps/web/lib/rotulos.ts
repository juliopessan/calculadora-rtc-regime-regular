export type Tom = "ok" | "err" | "neutro" | "warn";
export const ROTULO_STATUS_SKU: Record<string, { texto: string; tom: Tom; icone: string }> = {
  NA_FILA: { texto: "Na fila", tom: "neutro", icone: "sync" },
  CERTIFICADO_AUTO: { texto: "Certificado (auto)", tom: "ok", icone: "success" },
  CERTIFICADO_REVISADO: { texto: "Certificado (revisado)", tom: "ok", icone: "success" },
  EM_REVISAO: { texto: "Em revisão", tom: "warn", icone: "eye" },
  PENDENTE_CLIENTE: { texto: "Pendente com cliente", tom: "err", icone: "warning" },
  NAO_SUPORTADO: { texto: "Não suportado", tom: "neutro", icone: "info" },
  ERRO_TEMPORARIO: { texto: "Erro temporário", tom: "err", icone: "error" },
};
export const ROTULO_STATUS_LOTE: Record<string, string> = {
  NA_FILA: "Na fila",
  PROCESSANDO: "Processando",
  EM_REVISAO: "Em revisão",
  CONCLUIDO: "Concluído e assinado",
};
export const ROTULO_PAPEL: Record<string, string> = {
  socio: "Sócio",
  contador_responsavel: "Contador responsável",
  analista: "Analista",
};
export const ROTULO_REGIME: Record<string, string> = { regular: "Regime regular", simples: "Simples Nacional" };
export const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);
export const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

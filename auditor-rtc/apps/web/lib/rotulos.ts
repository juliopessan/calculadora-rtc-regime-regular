export const ROTULO_STATUS_SKU: Record<string, { texto: string; tom: "ok" | "warn" | "danger" | "neutro" }> = {
  NA_FILA: { texto: "Na fila", tom: "neutro" },
  CERTIFICADO_AUTO: { texto: "Certificado (auto)", tom: "ok" },
  CERTIFICADO_REVISADO: { texto: "Certificado (revisado)", tom: "ok" },
  EM_REVISAO: { texto: "Em revisão", tom: "warn" },
  PENDENTE_CLIENTE: { texto: "Pendente com cliente", tom: "danger" },
  NAO_SUPORTADO: { texto: "Não suportado", tom: "neutro" },
  ERRO_TEMPORARIO: { texto: "Erro temporário", tom: "danger" },
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
export const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

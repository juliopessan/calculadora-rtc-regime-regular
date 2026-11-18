import type { Decision } from "@auditor/classifier";
import type { Candidato, Verificacao } from "@auditor/tax-pack";

export type SkuStatus =
  | "NA_FILA"
  | "CERTIFICADO_AUTO"
  | "CERTIFICADO_REVISADO"
  | "EM_REVISAO"
  | "PENDENTE_CLIENTE"
  | "NAO_SUPORTADO"
  | "ERRO_TEMPORARIO";

/** Status que geram cobrança (Global Constraints). */
export const STATUS_COBRAVEIS: readonly SkuStatus[] = ["CERTIFICADO_AUTO", "CERTIFICADO_REVISADO"];

export type SkuEntrada = { codigo: string; descricao: string; ncmBruto: string; gtin?: string };

export type IngestResult = {
  skus: SkuEntrada[];
  duplicados: number;
  erros: { linha: number; motivo: string }[];
};

export type SkuResultado = {
  status: SkuStatus;
  ncm: string | null;
  decisao?: Decision;
  candidatos?: Candidato[];
  escolhido?: Candidato;
  verificacao?: Verificacao;
  motivo?: string;
  tentativas: number;
};

export type Politica = {
  /** null = sem calibração → tudo vai para revisão humana. */
  threshold: number | null;
  maxTentativas: number;
};

export const POLITICA_PADRAO: Politica = { threshold: null, maxTentativas: 3 };

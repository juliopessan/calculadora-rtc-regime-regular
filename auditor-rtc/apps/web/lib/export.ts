import type { SkuRow } from "@auditor/db";
import type { Candidato } from "@auditor/tax-pack";

export type SkuLinha = {
  codigo: string;
  descricao: string;
  ncm: string;
  cst: string;
  cClassTrib: string;
  status: string;
  confianca: number | null;
  fundamento: string;
  motorVersao: string;
};

export const CABECALHO_CSV = "codigo;descricao;ncm;cst;cClassTrib;status;confianca;fundamento;motor_versao";

/** Fundamento do SKU: descrição oficial da classificação escolhida + memória de cálculo do motor. */
export function fundamentoDe(s: SkuRow): string {
  const escolhido = ((s.candidatos ?? []) as Candidato[]).find((c) => c.codigo === s.cClassTrib);
  const memoria = (s.verificacao as { memoriaCalculo?: string } | null)?.memoriaCalculo;
  return [escolhido?.descricao, memoria].filter(Boolean).join(" — ");
}

export function paraLinha(s: SkuRow, motorVersao: string | null): SkuLinha {
  return {
    codigo: s.codigo,
    descricao: s.descricao,
    ncm: s.ncm ?? s.ncmBruto,
    cst: s.cst ?? "",
    cClassTrib: s.cClassTrib ?? "",
    status: s.status,
    confianca: s.confianca,
    fundamento: fundamentoDe(s),
    motorVersao: motorVersao ?? "",
  };
}

function celula(v: string): string {
  const seguro = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v; // evita fórmula no Excel
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV no padrão do Excel brasileiro: UTF-8 com BOM, ';' e vírgula decimal. */
export function exportarCsv(linhas: SkuLinha[]): string {
  const corpo = linhas.map((l) =>
    [l.codigo, l.descricao, l.ncm, l.cst, l.cClassTrib, l.status, l.confianca === null ? "" : String(l.confianca).replace(".", ","), l.fundamento, l.motorVersao]
      .map(celula)
      .join(";"),
  );
  return "﻿" + [CABECALHO_CSV, ...corpo].join("\r\n") + "\r\n";
}

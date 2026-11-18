import Papa from "papaparse";
import { normalizarNcm } from "@auditor/tax-pack";
import type { IngestResult, SkuEntrada } from "./types.ts";

export const MAX_LINHAS = 50_000;

const ALIASES: Record<"codigo" | "descricao" | "ncm" | "gtin", string[]> = {
  codigo: ["codigo", "sku", "cod"],
  descricao: ["descricao", "produto", "nome"],
  ncm: ["ncm"],
  gtin: ["gtin", "ean", "codigo de barras"],
};

/** Lê o cadastro como o ERP exporta: UTF-8 ou Latin-1, separado por ';' ou ','. */
export function ingerirCsv(buf: Uint8Array): IngestResult {
  const text = decodificar(buf).replace(/^﻿/, "");
  if (text.trim() === "") return falha("arquivo vazio");

  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: true });
  const [header, ...rows] = parsed.data;
  if (!header) return falha("arquivo vazio");
  if (rows.length > MAX_LINHAS) return falha("máximo de 50.000 linhas por lote");

  const cols = mapearColunas(header);
  if (cols.descricao === undefined || cols.ncm === undefined) return falha("colunas obrigatórias: descricao, ncm");

  const skus: SkuEntrada[] = [];
  const erros: IngestResult["erros"] = [];
  const vistos = new Set<string>();
  let duplicados = 0;

  rows.forEach((row, i) => {
    const linha = i + 2; // 1 = cabeçalho
    const descricao = (row[cols.descricao!] ?? "").trim();
    const ncmBruto = (row[cols.ncm!] ?? "").trim();
    if (!descricao) {
      erros.push({ linha, motivo: "descrição vazia" });
      return;
    }
    const gtin = cols.gtin !== undefined ? (row[cols.gtin] ?? "").trim() : "";
    const chave = [normalizarTexto(descricao), normalizarNcm(ncmBruto) ?? ncmBruto, gtin].join("|");
    if (vistos.has(chave)) {
      duplicados++;
      return;
    }
    vistos.add(chave);
    const codigo = cols.codigo !== undefined && row[cols.codigo]?.trim() ? row[cols.codigo]!.trim() : `linha-${linha}`;
    skus.push({ codigo, descricao, ncmBruto, ...(gtin ? { gtin } : {}) });
  });

  return { skus, duplicados, erros };
}

function decodificar(buf: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("latin1").decode(buf);
  }
}

function mapearColunas(header: string[]) {
  const norm = header.map(normalizarTexto);
  const find = (aliases: string[]) => {
    const i = norm.findIndex((h) => aliases.includes(h));
    return i >= 0 ? i : undefined;
  };
  return { codigo: find(ALIASES.codigo), descricao: find(ALIASES.descricao), ncm: find(ALIASES.ncm), gtin: find(ALIASES.gtin) };
}

function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const falha = (motivo: string): IngestResult => ({ skus: [], duplicados: 0, erros: [{ linha: 0, motivo }] });

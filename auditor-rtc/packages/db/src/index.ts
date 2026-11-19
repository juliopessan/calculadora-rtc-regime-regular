import pg from "pg";
// Datas (tipo date) chegam como 'YYYY-MM-DD', sem fuso.
pg.types.setTypeParser(1082, (v: string) => v);

export * from "./db.ts";
export type { Client } from "./db.ts";
export * as repos from "./repos.ts";
export type { ItemRevisaoCenario, RevisaoCenario, Regime, Lote, LoteResumo, SkuRow, SkuPatch, StatusLote, StatusSku, Escritorio } from "./repos.ts";

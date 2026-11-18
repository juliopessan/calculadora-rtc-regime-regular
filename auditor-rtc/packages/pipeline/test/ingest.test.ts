import { describe, it, expect } from "vitest";
import { ingerirCsv } from "../src/index.ts";

const latin1 = (s: string) => Uint8Array.from([...s].map((ch) => ch.charCodeAt(0)));
const utf8 = (s: string) => new TextEncoder().encode(s);

describe("ingerirCsv", () => {
  it("reads ';' separated Latin-1 with accented headers", () => {
    const r = ingerirCsv(latin1("Código;Descrição;NCM;EAN\n1;Arroz branco tipo 1;1006.30.21;7891234567890\n2;Feijão carioca;07133319;\n"));
    expect(r.erros).toEqual([]);
    expect(r.skus).toEqual([
      { codigo: "1", descricao: "Arroz branco tipo 1", ncmBruto: "1006.30.21", gtin: "7891234567890" },
      { codigo: "2", descricao: "Feijão carioca", ncmBruto: "07133319" },
    ]);
  });

  it("reads ',' separated UTF-8", () => {
    const r = ingerirCsv(utf8("sku,produto,ncm\nA,Cerveja lata,22030000\n"));
    expect(r.skus).toEqual([{ codigo: "A", descricao: "Cerveja lata", ncmBruto: "22030000" }]);
  });

  it("reports missing required columns at line 0", () => {
    const r = ingerirCsv(utf8("codigo;nome\n1;Arroz\n"));
    expect(r.skus).toEqual([]);
    expect(r.erros).toEqual([{ linha: 0, motivo: "colunas obrigatórias: descricao, ncm" }]);
  });

  it("deduplicates by normalized description, NCM and GTIN", () => {
    const r = ingerirCsv(utf8("codigo;descricao;ncm\n1;Arroz  Branco;10063021\n2;arroz branco;1006.30.21\n3;Feijão;07133319\n"));
    expect(r.skus.map((s) => s.codigo)).toEqual(["1", "3"]);
    expect(r.duplicados).toBe(1);
  });

  it("generates a code when the column is missing and flags blank descriptions", () => {
    const r = ingerirCsv(utf8("descricao;ncm\nArroz;10063021\n;22030000\n"));
    expect(r.skus).toEqual([{ codigo: "linha-2", descricao: "Arroz", ncmBruto: "10063021" }]);
    expect(r.erros).toEqual([{ linha: 3, motivo: "descrição vazia" }]);
  });

  it("rejects empty files", () => {
    expect(ingerirCsv(utf8("")).erros).toEqual([{ linha: 0, motivo: "arquivo vazio" }]);
  });

  it("rejects files above 50.000 rows", () => {
    const body = Array.from({ length: 50_001 }, (_, i) => `${i};Item ${i};10063021`).join("\n");
    const r = ingerirCsv(utf8(`codigo;descricao;ncm\n${body}\n`));
    expect(r.skus).toEqual([]);
    expect(r.erros).toEqual([{ linha: 0, motivo: "máximo de 50.000 linhas por lote" }]);
  });
});

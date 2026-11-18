import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createTestDb } from "@auditor/db/test-helpers";
import { repos } from "@auditor/db";
import { setDbForTests } from "@/lib/db";
import { exportarCsv, CABECALHO_CSV, type SkuLinha } from "@/lib/export";
import { carregarRelatorio } from "@/lib/relatorio";
import { RelatorioView } from "@/components/relatorio-view";

const linha = (o: Partial<SkuLinha> = {}): SkuLinha => ({
  codigo: "1", descricao: "Arroz branco", ncm: "10063021", cst: "200", cClassTrib: "200003",
  status: "CERTIFICADO_REVISADO", confianca: 0.81, fundamento: "Anexo I", motorVersao: "1.6.1/V0059", ...o,
});

describe("exportarCsv", () => {
  it("starts with a BOM and the exact header", () => {
    const csv = exportarCsv([linha()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")[0]).toBe("codigo;descricao;ncm;cst;cClassTrib;status;confianca;fundamento;motor_versao");
    expect(CABECALHO_CSV).toBe("codigo;descricao;ncm;cst;cClassTrib;status;confianca;fundamento;motor_versao");
  });

  it("quotes fields containing ';', quotes or line breaks", () => {
    const csv = exportarCsv([linha({ descricao: 'Sabão "neutro"; 1kg' })]);
    expect(csv).toContain('"Sabão ""neutro""; 1kg"');
  });

  it("neutralizes spreadsheet formulas", () => {
    const csv = exportarCsv([linha({ descricao: "=HYPERLINK(\"x\")" })]);
    expect(csv).toContain("'=HYPERLINK");
  });

  it("formats confidence with a comma decimal", () => {
    expect(exportarCsv([linha({ confianca: 0.81 })])).toContain(";0,81;");
  });
});

describe("relatório white-label", () => {
  let t: Awaited<ReturnType<typeof createTestDb>>;
  let token: string;
  let loteAberto: string;

  beforeAll(async () => {
    t = await createTestDb();
    setDbForTests(t.db);
    const { escritorioId, usuarioId } = await t.db.criarEscritorioComSocio({ escritorio: "Contábil Alfa", nome: "Ana", email: "r@a.com", senhaHash: "h" });
    await t.db.withTenant(escritorioId, async (c) => {
      await repos.atualizarMarca(c, { nome: "Contábil Alfa", corPrimaria: "#0a7c66", logoUrl: null });
      const l = await repos.criarLote(c, { cliente: "Mercado X", dataReferencia: "2026-11-18", skus: [{ codigo: "1", descricao: "Arroz", ncmBruto: "10063021" }] });
      const [s] = await repos.listarSkus(c, l.id);
      await repos.atualizarSku(c, s!.id, {
        status: "CERTIFICADO_REVISADO", cst: "200", cClassTrib: "200003", ncm: "10063021",
        candidatos: [{ codigo: "200003", cst: "200", descricao: "Vendas de produtos destinados à alimentação humana (Anexo I)", descricaoTratamentoTributario: "Redução de 100%", nomenclatura: "", dfes: ["NF-e"], possuiPercentualReducao: true }],
        verificacao: { ok: true, estadoItem: "CALCULADO", erros: [], memoriaCalculo: "enquadramento legal em Art. 125", motorVersao: "1.6.1/V0059" },
      });
      await repos.atualizarLote(c, l.id, { status: "EM_REVISAO", motorVersao: "1.6.1/V0059" });
      token = (await repos.concluirLote(c, l.id, usuarioId)).tokenRelatorio!;
      loteAberto = (await repos.criarLote(c, { cliente: "Y", dataReferencia: "2026-11-18", skus: [] })).id;
    });
  });
  afterAll(async () => t.drop());

  it("renders the office brand and never ours", async () => {
    const dados = await carregarRelatorio(token);
    const html = renderToStaticMarkup(RelatorioView({ dados: dados! }));
    expect(html).toContain("Contábil Alfa");
    expect(html).toContain("#0a7c66");
    expect(html).toContain("200003");
    expect(html).toContain("Anexo I");
    expect(html).toContain("1.6.1/V0059");
    expect(html).not.toMatch(/Auditor RTC/i);
  });

  it("returns null for an unknown or malformed token", async () => {
    expect(await carregarRelatorio("x".repeat(43))).toBeNull();
    expect(await carregarRelatorio("'; drop table lotes; --")).toBeNull();
  });

  it("has no token for a lote that is not concluded", async () => {
    const row = await t.db.withSystem(async (c) => (await c.query("SELECT token_relatorio FROM lotes WHERE id = $1", [loteAberto])).rows[0]).catch(() => null);
    expect(row?.token_relatorio ?? null).toBeNull();
  });
});

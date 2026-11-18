import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { FakeBackend } from "@auditor/classifier";
import type { EngineClient, Classificacao } from "@auditor/tax-pack";
import { criarServidor } from "../src/server.ts";

const cls = (codigo: string): Classificacao => ({
  codigo, cst: codigo.slice(0, 3), descricao: `desc ${codigo}`, nomenclatura: "NCM",
  descricaoTratamentoTributario: "t", dfes: ["NF-e"], possuiPercentualReducao: false,
});

const engine = {
  async versao() { return "1.6.1/V0059"; },
  async ncmExiste() { return true; },
  async classificacoes() { return [cls("000001"), cls("200003"), cls("200035")]; },
  async ncmAplicavel() { return true; },
  async calcularItem(item: { cClassTrib: string }) {
    return item.cClassTrib === "200035"
      ? { estadoItem: "INCONSISTENCIA_ENTRADA" as const, erros: [{ code: "REG-011", detail: "NCM não vinculada" }] }
      : { estadoItem: "CALCULADO" as const, erros: [], memoriaCalculo: "Art. 125" };
  },
  async descreverErro(codigo: string) { return { codigo, titulo: "NCM não vinculada", descricao: "O código NCM..." }; },
} as unknown as EngineClient;

async function conectar() {
  const server = criarServidor({ engine, backend: new FakeBackend(() => ({ choice: "200003", confidence: 0.9 })), cenario: { versao: "t", revisadoPor: null, permitidos: [{ codigo: "000001", motivo: "" }, { codigo: "200003", motivo: "" }] } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "teste", version: "0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const texto = (r: unknown) => JSON.parse(((r as { content: { text: string }[] }).content[0]!).text);

describe("servidor MCP", () => {
  it("lists the four tools", async () => {
    const c = await conectar();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["buscar_candidatos", "classificar", "explicar_erro_reg", "verificar_no_motor"]);
  });

  it("buscar_candidatos returns the codes for an NCM", async () => {
    const c = await conectar();
    const r = await c.callTool({ name: "buscar_candidatos", arguments: { ncm: "1006.30.21", data: "2026-11-18" } });
    expect(texto(r).candidatos.map((x: { codigo: string }) => x.codigo)).toEqual(["000001", "200003"]);
  });

  it("classificar runs the leader pipeline and never auto-certifies without a threshold", async () => {
    const c = await conectar();
    const r = await c.callTool({ name: "classificar", arguments: { descricao: "Arroz", ncm: "10063021", data: "2026-11-18" } });
    expect(texto(r)).toMatchObject({ status: "EM_REVISAO", cClassTrib: "200003", confianca: 0.9, verificacao: { ok: true } });
  });

  it("verificar_no_motor reports REG errors", async () => {
    const c = await conectar();
    const r = await c.callTool({ name: "verificar_no_motor", arguments: { ncm: "02013000", cClassTrib: "200035", data: "2026-11-18" } });
    expect(texto(r)).toMatchObject({ ok: false, erros: [{ code: "REG-011" }] });
  });

  it("verificar_no_motor rejects a cClassTrib missing from the table", async () => {
    const c = await conectar();
    const r = await c.callTool({ name: "verificar_no_motor", arguments: { ncm: "02013000", cClassTrib: "999999", data: "2026-11-18" } });
    expect(r.isError).toBe(true);
  });

  it("explicar_erro_reg rejects malformed codes", async () => {
    const c = await conectar();
    const r = await c.callTool({ name: "explicar_erro_reg", arguments: { codigo: "../../etc" } });
    expect(r.isError).toBe(true);
    const ok = await c.callTool({ name: "explicar_erro_reg", arguments: { codigo: "REG-011" } });
    expect(texto(ok).titulo).toBe("NCM não vinculada");
  });
});

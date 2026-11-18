import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DecisionBackend } from "@auditor/classifier";
import { CandidateIndex, normalizarNcm, verificar, type Cenario, type EngineClient } from "@auditor/tax-pack";
import { executarSku, POLITICA_PADRAO } from "@auditor/pipeline";

export type DepsServidor = {
  engine: Pick<EngineClient, "versao" | "ncmExiste" | "classificacoes" | "ncmAplicavel" | "calcularItem" | "descreverErro">;
  backend: DecisionBackend;
  cenario?: Cenario;
  municipio?: number;
  uf?: string;
};

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD");
const ok = (dados: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(dados, null, 2) }] });
const falha = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });

/**
 * Ferramentas MCP das skills especialistas. Mesma regra do produto:
 * o modelo só escolhe entre candidatos e todo resultado é verificado no motor.
 */
export function criarServidor(deps: DepsServidor): McpServer {
  const server = new McpServer({ name: "auditor-rtc", version: "0.1.0" });
  const indices = new Map<string, CandidateIndex>();
  const indice = (data: string) => {
    let i = indices.get(data);
    if (!i) indices.set(data, (i = new CandidateIndex(deps.engine, data, deps.cenario ? { cenario: deps.cenario } : {})));
    return i;
  };
  const ctx = async (data: string) => ({
    data,
    municipio: deps.municipio ?? 4314902,
    uf: deps.uf ?? "RS",
    motorVersao: await deps.engine.versao(),
  });

  server.registerTool(
    "buscar_candidatos",
    {
      description: "Lista os cClassTrib válidos (cenário venda interna v1, NF-e) para um NCM na data informada.",
      inputSchema: { ncm: z.string(), data: DATA },
    },
    async ({ ncm, data }) => {
      const n = normalizarNcm(ncm);
      if (!n) return falha("NCM inválido");
      const candidatos = await indice(data).candidatosPara(n);
      return ok({ ncm: n, candidatos: candidatos.map((c) => ({ codigo: c.codigo, cst: c.cst, descricao: c.descricao, tratamento: c.descricaoTratamentoTributario })) });
    },
  );

  server.registerTool(
    "classificar",
    {
      description: "Executa o pipeline da skill líder para uma mercadoria: candidatos → classificação → verificação no motor → roteamento. Sem limiar calibrado, o resultado vai para revisão humana.",
      inputSchema: { descricao: z.string().min(1), ncm: z.string(), data: DATA },
    },
    async ({ descricao, ncm, data }) => {
      const r = await executarSku(
        { codigo: "mcp", descricao, ncmBruto: ncm },
        { index: indice(data), backend: deps.backend, engine: deps.engine, ctx: await ctx(data), politica: POLITICA_PADRAO },
      );
      return ok({
        status: r.status,
        ncm: r.ncm,
        cst: r.escolhido?.cst ?? null,
        cClassTrib: r.escolhido?.codigo ?? null,
        descricaoClassificacao: r.escolhido?.descricao ?? null,
        confianca: r.decisao?.confidence ?? null,
        probabilidades: r.decisao?.probabilities ?? null,
        verificacao: r.verificacao ?? null,
        motivo: r.motivo ?? null,
      });
    },
  );

  server.registerTool(
    "verificar_no_motor",
    {
      description: "Verifica no motor oficial se o par NCM + cClassTrib é aceito (devolve estadoItem e códigos REG).",
      inputSchema: { ncm: z.string(), cClassTrib: z.string().regex(/^\d{6}$/), data: DATA },
    },
    async ({ ncm, cClassTrib, data }) => {
      const n = normalizarNcm(ncm);
      if (!n) return falha("NCM inválido");
      const todas = await deps.engine.classificacoes(data);
      const c = todas.find((x) => x.codigo === cClassTrib);
      if (!c) return falha(`cClassTrib ${cClassTrib} não existe na tabela vigente`);
      return ok(await verificar(deps.engine, n, c, await ctx(data)));
    },
  );

  server.registerTool(
    "explicar_erro_reg",
    {
      description: "Descrição oficial de um código de erro da Calculadora (REG-xxx ou CAL-xxx).",
      inputSchema: { codigo: z.string() },
    },
    async ({ codigo }) => {
      const c = codigo.trim().toUpperCase();
      if (!/^(REG|CAL)-\d{3}$/.test(c)) return falha("Código inválido: use o formato REG-011");
      return ok(await deps.engine.descreverErro(c));
    },
  );

  return server;
}

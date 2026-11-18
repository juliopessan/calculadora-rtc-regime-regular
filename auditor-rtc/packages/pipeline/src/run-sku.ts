import { classify, ClassifierUnavailableError, type Decision, type DecisionBackend } from "@auditor/classifier";
import {
  EngineUnavailableError,
  normalizarNcm,
  verificar,
  type Candidato,
  type CandidateIndex,
  type ContextoVerificacao,
  type EngineClient,
  type Verificacao,
} from "@auditor/tax-pack";
import { rotear } from "./router.ts";
import type { Politica, SkuEntrada, SkuResultado } from "./types.ts";

export const INSTRUCAO_CLASSIFICACAO =
  "Qual classificação tributária IBS/CBS (cClassTrib) se aplica a esta mercadoria em venda interna no regime regular?";

export type DepsSku = {
  index: CandidateIndex;
  backend: DecisionBackend;
  engine: Pick<EngineClient, "ncmExiste" | "calcularItem">;
  ctx: ContextoVerificacao;
  politica: Politica;
};

/**
 * Executa o pipeline de um SKU (skill líder): normaliza → candidatos → classifica →
 * verifica no motor (com nova escolha se o motor recusar) → roteia.
 */
export async function executarSku(sku: SkuEntrada, deps: DepsSku): Promise<SkuResultado> {
  const ncm = normalizarNcm(sku.ncmBruto);
  if (!ncm) return { status: "PENDENTE_CLIENTE", ncm: null, motivo: "NCM inválido", tentativas: 0 };

  try {
    if (!(await deps.engine.ncmExiste(ncm, deps.ctx.data))) {
      return { status: "PENDENTE_CLIENTE", ncm, motivo: "NCM inexistente ou fora de vigência", tentativas: 0 };
    }
    const candidatos = await deps.index.candidatosPara(ncm);
    if (candidatos.length === 0) {
      return { status: "PENDENTE_CLIENTE", ncm, candidatos, motivo: "NCM sem classificação vinculada", tentativas: 0 };
    }

    let restantes = candidatos;
    let ultima: { decisao: Decision; escolhido: Candidato; verificacao: Verificacao } | undefined;
    let tentativas = 0;

    while (restantes.length > 0 && tentativas < deps.politica.maxTentativas) {
      tentativas++;
      const decisao = await classify(
        {
          state: { descricao: sku.descricao, ncm },
          instruction: INSTRUCAO_CLASSIFICACAO,
          candidates: restantes.map((c) => ({ id: c.codigo, description: `${c.descricao} — ${c.descricaoTratamentoTributario}` })),
        },
        deps.backend,
      );
      const escolhido = restantes.find((c) => c.codigo === decisao.choice)!;
      const verificacao = await verificar(deps.engine, ncm, escolhido, deps.ctx);
      ultima = { decisao, escolhido, verificacao };

      if (verificacao.estadoItem === "NAO_IMPLEMENTADO") {
        return { status: "NAO_SUPORTADO", ncm, candidatos, ...ultima, motivo: "tratamento não implementado no motor", tentativas };
      }
      if (verificacao.ok) {
        return { status: rotear(decisao, verificacao, deps.politica), ncm, candidatos, ...ultima, tentativas };
      }
      if (verificacao.estadoItem === "FALHA_TECNICA") throw new EngineUnavailableError("falha técnica no motor");
      restantes = restantes.filter((c) => c.codigo !== escolhido.codigo);
    }

    const codigos = ultima?.verificacao.erros.map((e) => e.code).join(", ") || "verificação recusada";
    return { status: "EM_REVISAO", ncm, candidatos, ...ultima, motivo: codigos, tentativas };
  } catch (err) {
    if (err instanceof ClassifierUnavailableError || err instanceof EngineUnavailableError) {
      return { status: "ERRO_TEMPORARIO", ncm, motivo: err.message, tentativas: 0 };
    }
    throw err;
  }
}

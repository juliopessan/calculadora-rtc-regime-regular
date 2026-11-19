import type { DecisionBackend } from "@auditor/classifier";
import { CandidateIndex, type Cenario, type EngineClient } from "@auditor/tax-pack";
import { executarSku, POLITICA_PADRAO, type SkuResultado } from "@auditor/pipeline";
import { repos, type Client, type Db, type SkuPatch, type SkuRow } from "@auditor/db";

export type DepsLote = {
  backend: DecisionBackend;
  engine: Pick<EngineClient, "versao" | "ncmExiste" | "classificacoes" | "ncmAplicavel" | "calcularItem">;
  cenario?: Cenario;
  municipio?: number;
  uf?: string;
  concurrency?: number;
};

/**
 * Processa os SKUs NA_FILA/ERRO_TEMPORARIO de um lote. É idempotente e retomável:
 * rodar de novo só reprocessa o que não terminou. A conexão sem RLS é usada só
 * para descobrir o escritório; todo o resto roda dentro do tenant do lote.
 */
export async function processarLote(db: Db, loteId: string, deps: DepsLote): Promise<{ processados: number; temporarios: number }> {
  const escritorioId = await db.withSystem(async (c) => {
    const r = await c.query<{ escritorio_id: string }>("SELECT escritorio_id FROM lotes WHERE id = $1", [loteId]);
    return r.rows[0]?.escritorio_id;
  });
  if (!escritorioId) throw new Error(`lote ${loteId} não encontrado`);

  const inTenant = <T>(fn: (c: Client) => Promise<T>) => db.withTenant(escritorioId, fn);

  const lote = (await inTenant((c) => repos.obterLote(c, loteId)))!;
  const motorVersao = await deps.engine.versao();
  await inTenant((c) => repos.atualizarLote(c, loteId, { status: "PROCESSANDO", motorVersao }));

  const todos = await inTenant((c) => repos.listarSkus(c, loteId));
  const fila = todos.filter((s) => s.status === "NA_FILA" || s.status === "ERRO_TEMPORARIO");

  const ctx = {
    data: lote.dataReferencia,
    municipio: deps.municipio ?? Number(process.env.VERIFY_MUNICIPIO ?? 4314902),
    uf: deps.uf ?? process.env.VERIFY_UF ?? "RS",
    motorVersao,
  };
  const index = new CandidateIndex(deps.engine, ctx.data, deps.cenario ? { cenario: deps.cenario } : {});
  const politica = { ...POLITICA_PADRAO, threshold: lote.threshold };

  let temporarios = 0;
  await forEachLimit(fila, deps.concurrency ?? 8, async (sku) => {
    let r: SkuResultado;
    try {
      r = await executarSku(
        { codigo: sku.codigo, descricao: sku.descricao, ncmBruto: sku.ncmBruto, ...(sku.gtin ? { gtin: sku.gtin } : {}) },
        { index, backend: deps.backend, engine: deps.engine, ctx, politica },
      );
    } catch (err) {
      // Um SKU problemático não pode travar o lote: vai para revisão humana.
      r = { status: "EM_REVISAO", ncm: null, motivo: `erro inesperado: ${(err as Error).message}`, tentativas: 0 };
    }
    if (r.status === "ERRO_TEMPORARIO") temporarios++;
    await inTenant(async (c) => {
      await repos.atualizarSku(c, sku.id, patchDe(sku, r));
      await c.query("UPDATE lotes SET reivindicado_em = now() WHERE id = $1", [loteId]); // renova a concessão
      await repos.registrarEvento(c, {
        loteId,
        skuId: sku.id,
        tipo: "sku_processado",
        dados: {
          status: r.status,
          escolhido: r.escolhido?.codigo ?? null,
          confianca: r.decisao?.confidence ?? null,
          backend: r.decisao?.backend ?? null,
          modelo: r.decisao?.modelVersion ?? null,
          motorVersao,
          cenario: deps.cenario?.versao ?? "venda-interna-v1",
        },
      });
    });
  });

  await inTenant((c) => repos.atualizarLote(c, loteId, { status: "EM_REVISAO" }));
  return { processados: fila.length, temporarios };
}

function patchDe(sku: SkuRow, r: SkuResultado): SkuPatch {
  return {
    status: r.status,
    ncm: r.ncm,
    cst: r.escolhido?.cst ?? null,
    cClassTrib: r.escolhido?.codigo ?? null,
    confianca: r.decisao?.confidence ?? null,
    probabilidades: r.decisao?.probabilities ?? null,
    candidatos: r.candidatos ?? null,
    verificacao: (r.verificacao as Record<string, unknown> | undefined) ?? null,
    motivo: r.motivo ?? null,
    tentativas: sku.tentativas + r.tentativas,
  };
}

/** Concessão: sem renovação por este tempo, um lote PROCESSANDO volta a ser reivindicável. */
export const CONCESSAO_MINUTOS = 10;

/** Pega o lote NA_FILA mais antigo (ou um PROCESSANDO abandonado) e o marca PROCESSANDO (seguro com vários workers). */
export async function reivindicarProximoLote(db: Db): Promise<{ loteId: string; escritorioId: string } | null> {
  return db.withSystem(async (c) => {
    const r = await c.query<{ id: string; escritorio_id: string }>(
      `UPDATE lotes SET status = 'PROCESSANDO', reivindicado_em = now()
       WHERE id = (
         SELECT id FROM lotes
         WHERE status = 'NA_FILA'
            OR (status = 'PROCESSANDO' AND (reivindicado_em IS NULL OR reivindicado_em < now() - make_interval(mins => $1)))
         ORDER BY criado_em FOR UPDATE SKIP LOCKED LIMIT 1)
       RETURNING id, escritorio_id`,
      [CONCESSAO_MINUTOS],
    );
    const row = r.rows[0];
    return row ? { loteId: row.id, escritorioId: row.escritorio_id } : null;
  });
}

async function forEachLimit<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

import { randomBytes } from "node:crypto";
import type { Client } from "./db.ts";

export type StatusLote = "NA_FILA" | "PROCESSANDO" | "EM_REVISAO" | "CONCLUIDO";
export type StatusSku =
  | "NA_FILA" | "CERTIFICADO_AUTO" | "CERTIFICADO_REVISADO" | "EM_REVISAO" | "PENDENTE_CLIENTE" | "NAO_SUPORTADO" | "ERRO_TEMPORARIO";

export type Regime = "regular" | "simples";

export type Lote = {
  id: string;
  regime: Regime;
  clienteId: string;
  cliente: string;
  status: StatusLote;
  dataReferencia: string;
  motorVersao: string | null;
  threshold: number | null;
  total: number;
  duplicados: number;
  tokenRelatorio: string | null;
  concluidoPor: string | null;
  concluidoEm: Date | null;
  criadoEm: Date;
};

export type LoteResumo = Lote & { emRevisao: number; certificados: number; auto: number; cobraveis: number; pendentes: number };

export type SkuRow = {
  id: string;
  loteId: string;
  ordem: number;
  codigo: string;
  descricao: string;
  ncmBruto: string;
  ncm: string | null;
  gtin: string | null;
  status: StatusSku;
  cst: string | null;
  cClassTrib: string | null;
  confianca: number | null;
  probabilidades: Record<string, number> | null;
  candidatos: unknown[] | null;
  verificacao: Record<string, unknown> | null;
  motivo: string | null;
  tentativas: number;
  revisadoPor: string | null;
  /** Escolha original do modelo, gravada uma vez; base do rótulo da calibração. */
  escolhaModelo: string | null;
  confiancaModelo: number | null;
  backendModelo: string | null;
};

export type SkuPatch = Partial<Pick<SkuRow, "status" | "ncm" | "cst" | "cClassTrib" | "confianca" | "probabilidades" | "candidatos" | "verificacao" | "motivo" | "tentativas" | "revisadoPor" | "escolhaModelo" | "confiancaModelo" | "backendModelo">>;

export type Escritorio = { id: string; nome: string; corPrimaria: string; logoUrl: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: string) => UUID.test(s);

const LOTE_SELECT = `
  SELECT l.*, c.nome AS cliente FROM lotes l JOIN clientes c ON c.id = l.cliente_id`;

function toLote(r: Record<string, any>): Lote {
  return {
    id: r.id,
    regime: r.regime,
    clienteId: r.cliente_id,
    cliente: r.cliente,
    status: r.status,
    dataReferencia: r.data_referencia,
    motorVersao: r.motor_versao,
    threshold: r.threshold === null ? null : Number(r.threshold),
    total: r.total,
    duplicados: r.duplicados,
    tokenRelatorio: r.token_relatorio,
    concluidoPor: r.concluido_por,
    concluidoEm: r.concluido_em,
    criadoEm: r.criado_em,
  };
}

function toSku(r: Record<string, any>): SkuRow {
  return {
    id: r.id,
    loteId: r.lote_id,
    ordem: r.ordem,
    codigo: r.codigo,
    descricao: r.descricao,
    ncmBruto: r.ncm_bruto,
    ncm: r.ncm,
    gtin: r.gtin,
    status: r.status,
    cst: r.cst,
    cClassTrib: r.c_class_trib,
    confianca: r.confianca === null ? null : Number(r.confianca),
    probabilidades: r.probabilidades,
    candidatos: r.candidatos,
    verificacao: r.verificacao,
    motivo: r.motivo,
    tentativas: r.tentativas,
    revisadoPor: r.revisado_por,
    escolhaModelo: r.escolha_modelo,
    confiancaModelo: r.confianca_modelo === null ? null : Number(r.confianca_modelo),
    backendModelo: r.backend_modelo,
  };
}

export async function obterOuCriarCliente(c: Client, nome: string): Promise<string> {
  const r = await c.query<{ id: string }>(
    `INSERT INTO clientes (escritorio_id, nome) VALUES (tenant_atual(), $1)
     ON CONFLICT (escritorio_id, nome) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`,
    [nome.trim()],
  );
  return r.rows[0]!.id;
}

export async function criarLote(
  c: Client,
  i: { cliente: string; dataReferencia: string; skus: { codigo: string; descricao: string; ncmBruto: string; gtin?: string }[]; duplicados?: number; threshold?: number | null; regime?: Regime },
): Promise<Lote> {
  const clienteId = await obterOuCriarCliente(c, i.cliente);
  const r = await c.query<{ id: string }>(
    `INSERT INTO lotes (escritorio_id, cliente_id, data_referencia, total, duplicados, threshold, regime)
     VALUES (tenant_atual(), $1, $2, $3, $4, $5, $6) RETURNING id`,
    [clienteId, i.dataReferencia, i.skus.length, i.duplicados ?? 0, i.threshold ?? null, i.regime ?? "regular"],
  );
  const loteId = r.rows[0]!.id;
  await inserirSkus(c, loteId, i.skus);
  return (await obterLote(c, loteId))!;
}

export async function inserirSkus(c: Client, loteId: string, skus: { codigo: string; descricao: string; ncmBruto: string; gtin?: string }[]): Promise<void> {
  const CHUNK = 1000;
  for (let start = 0; start < skus.length; start += CHUNK) {
    const part = skus.slice(start, start + CHUNK);
    await c.query(
      `INSERT INTO skus (escritorio_id, lote_id, ordem, codigo, descricao, ncm_bruto, gtin)
       SELECT tenant_atual(), $1, o, cod, des, ncm, gt
       FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::text[]) AS t(o, cod, des, ncm, gt)`,
      [
        loteId,
        part.map((_, k) => start + k + 1),
        part.map((s) => s.codigo),
        part.map((s) => s.descricao),
        part.map((s) => s.ncmBruto),
        part.map((s) => s.gtin ?? null),
      ],
    );
  }
}

export async function obterLote(c: Client, id: string): Promise<Lote | null> {
  if (!isUuid(id)) return null;
  const r = await c.query(`${LOTE_SELECT} WHERE l.id = $1`, [id]);
  return r.rows[0] ? toLote(r.rows[0]) : null;
}

export async function listarLotes(c: Client): Promise<LoteResumo[]> {
  const r = await c.query(`
    SELECT l.*, c.nome AS cliente,
      count(s.id) FILTER (WHERE s.status = 'EM_REVISAO')::int AS em_revisao,
      count(s.id) FILTER (WHERE s.status IN ('CERTIFICADO_AUTO','CERTIFICADO_REVISADO'))::int AS certificados,
      count(s.id) FILTER (WHERE s.status = 'CERTIFICADO_AUTO')::int AS auto,
      count(s.id) FILTER (WHERE s.status IN ('NA_FILA','ERRO_TEMPORARIO'))::int AS pendentes
    FROM lotes l JOIN clientes c ON c.id = l.cliente_id LEFT JOIN skus s ON s.lote_id = l.id
    GROUP BY l.id, c.nome ORDER BY l.criado_em DESC`);
  return r.rows.map((row) => ({
    ...toLote(row),
    emRevisao: row.em_revisao,
    certificados: row.certificados,
    auto: row.auto,
    cobraveis: row.certificados,
    pendentes: row.pendentes,
  }));
}

export async function listarSkus(c: Client, loteId: string, status?: StatusSku): Promise<SkuRow[]> {
  if (!isUuid(loteId)) return [];
  const r = status
    ? await c.query("SELECT * FROM skus WHERE lote_id = $1 AND status = $2 ORDER BY ordem", [loteId, status])
    : await c.query("SELECT * FROM skus WHERE lote_id = $1 ORDER BY ordem", [loteId]);
  return r.rows.map(toSku);
}

export async function obterSku(c: Client, id: string): Promise<SkuRow | null> {
  if (!isUuid(id)) return null;
  const r = await c.query("SELECT * FROM skus WHERE id = $1", [id]);
  return r.rows[0] ? toSku(r.rows[0]) : null;
}

const COLS: Record<keyof SkuPatch, string> = {
  status: "status", ncm: "ncm", cst: "cst", cClassTrib: "c_class_trib", confianca: "confianca",
  probabilidades: "probabilidades", candidatos: "candidatos", verificacao: "verificacao",
  motivo: "motivo", tentativas: "tentativas", revisadoPor: "revisado_por",
  escolhaModelo: "escolha_modelo", confiancaModelo: "confianca_modelo", backendModelo: "backend_modelo",
};
const JSON_COLS = new Set(["probabilidades", "candidatos", "verificacao"]);

export async function atualizarSku(c: Client, id: string, patch: SkuPatch): Promise<void> {
  const keys = Object.keys(patch) as (keyof SkuPatch)[];
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${COLS[k]} = $${i + 2}`);
  const values = keys.map((k) => (JSON_COLS.has(k) && patch[k] != null ? JSON.stringify(patch[k]) : patch[k]));
  await c.query(`UPDATE skus SET ${sets.join(", ")}, atualizado_em = now() WHERE id = $1`, [id, ...values]);
}

export async function atualizarLote(c: Client, id: string, patch: Partial<{ status: StatusLote; motorVersao: string }>): Promise<void> {
  if (patch.status) await c.query("UPDATE lotes SET status = $2 WHERE id = $1", [id, patch.status]);
  if (patch.motorVersao) await c.query("UPDATE lotes SET motor_versao = $2 WHERE id = $1", [id, patch.motorVersao]);
}

export async function contarPorStatus(c: Client, loteId: string): Promise<Partial<Record<StatusSku, number>>> {
  const r = await c.query<{ status: StatusSku; n: number }>("SELECT status, count(*)::int AS n FROM skus WHERE lote_id = $1 GROUP BY status", [loteId]);
  return Object.fromEntries(r.rows.map((x) => [x.status, x.n]));
}

export async function contarCobraveis(c: Client, loteId: string): Promise<number> {
  const r = await c.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM skus WHERE lote_id = $1 AND status IN ('CERTIFICADO_AUTO','CERTIFICADO_REVISADO')",
    [loteId],
  );
  return r.rows[0]!.n;
}

export async function concluirLote(c: Client, id: string, usuarioId: string): Promise<Lote> {
  const token = randomBytes(32).toString("base64url");
  await c.query(
    "UPDATE lotes SET status = 'CONCLUIDO', concluido_por = $2, concluido_em = now(), token_relatorio = $3 WHERE id = $1",
    [id, usuarioId, token],
  );
  return (await obterLote(c, id))!;
}

export async function registrarEvento(
  c: Client,
  e: { loteId?: string; skuId?: string; usuarioId?: string; tipo: string; dados: Record<string, unknown>; escritorioId?: string },
): Promise<void> {
  await c.query(
    `INSERT INTO eventos_auditoria (escritorio_id, lote_id, sku_id, usuario_id, tipo, dados)
     VALUES (coalesce($6::uuid, tenant_atual()), $1, $2, $3, $4, $5)`,
    [e.loteId ?? null, e.skuId ?? null, e.usuarioId ?? null, e.tipo, JSON.stringify(e.dados), e.escritorioId ?? null],
  );
}

export async function obterEscritorio(c: Client): Promise<Escritorio> {
  const r = await c.query("SELECT id, nome, cor_primaria, logo_url FROM escritorios WHERE id = tenant_atual()");
  const e = r.rows[0]!;
  return { id: e.id, nome: e.nome, corPrimaria: e.cor_primaria, logoUrl: e.logo_url };
}

export async function atualizarMarca(c: Client, m: { nome: string; corPrimaria: string; logoUrl: string | null }): Promise<void> {
  await c.query("UPDATE escritorios SET nome = $1, cor_primaria = $2, logo_url = $3 WHERE id = tenant_atual()", [m.nome, m.corPrimaria, m.logoUrl]);
}

export async function criarUsuario(
  c: Client,
  u: { nome: string; email: string; senhaHash: string; papel: "socio" | "contador_responsavel" | "analista" },
): Promise<string> {
  try {
    const r = await c.query<{ id: string }>(
      "INSERT INTO usuarios (escritorio_id, email, senha_hash, nome, papel) VALUES (tenant_atual(), lower($1), $2, $3, $4) RETURNING id",
      [u.email, u.senhaHash, u.nome, u.papel],
    );
    return r.rows[0]!.id;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") throw new Error("e-mail já cadastrado");
    throw err;
  }
}

export async function listarUsuarios(c: Client): Promise<{ id: string; nome: string; email: string; papel: string }[]> {
  const r = await c.query("SELECT id, nome, email, papel FROM usuarios ORDER BY nome");
  return r.rows;
}

export async function nomeUsuario(c: Client, id: string | null): Promise<string | null> {
  if (!id || !isUuid(id)) return null;
  const r = await c.query<{ nome: string }>("SELECT nome FROM usuarios WHERE id = $1", [id]);
  return r.rows[0]?.nome ?? null;
}

/** Amostras rotuladas por humano: só SKUs revisados em que um modelo decidiu (auto-certificados não contam). */
export async function amostrasRotuladas(c: Client): Promise<{ confidence: number; correct: boolean }[]> {
  const r = await c.query<{ confianca: string; correto: boolean }>(
    `SELECT confianca_modelo AS confianca, (c_class_trib = escolha_modelo) AS correto
     FROM skus WHERE status = 'CERTIFICADO_REVISADO' AND escolha_modelo IS NOT NULL AND confianca_modelo IS NOT NULL`,
  );
  return r.rows.map((x) => ({ confidence: Number(x.confianca), correct: x.correto }));
}

export async function limiarEscritorio(c: Client): Promise<number | null> {
  const r = await c.query<{ threshold: string | null }>("SELECT threshold FROM escritorios WHERE id = tenant_atual()");
  const t = r.rows[0]?.threshold;
  return t === null || t === undefined ? null : Number(t);
}

export async function aplicarLimiar(
  c: Client,
  a: { threshold: number | null; amostras: number; precisao: number; cobertura: number; usuarioId: string },
): Promise<void> {
  await c.query("UPDATE escritorios SET threshold = $1 WHERE id = tenant_atual()", [a.threshold]);
  await c.query(
    "INSERT INTO calibracoes (escritorio_id, amostras, threshold, precisao, cobertura, aplicado_por) VALUES (tenant_atual(), $1, $2, $3, $4, $5)",
    [a.amostras, a.threshold, a.precisao, a.cobertura, a.usuarioId],
  );
}

export type ItemRevisaoCenario = { codigo: string; decisao: "concordo" | "discordo"; comentario?: string };
export type RevisaoCenario = { cenarioVersao: string; itens: ItemRevisaoCenario[]; sugeridos: string[]; discordancias: number; assinadoPor: string; criadoEm: Date };

export async function registrarRevisaoCenario(
  c: Client,
  r: { cenarioVersao: string; usuarioId: string; itens: ItemRevisaoCenario[]; sugeridos: string[] },
): Promise<void> {
  await c.query(
    "INSERT INTO revisoes_cenario (escritorio_id, cenario_versao, usuario_id, itens, sugeridos, discordancias) VALUES (tenant_atual(), $1, $2, $3, $4, $5)",
    [r.cenarioVersao, r.usuarioId, JSON.stringify(r.itens), JSON.stringify(r.sugeridos), r.itens.filter((i) => i.decisao === "discordo").length],
  );
}

export async function ultimaRevisaoCenario(c: Client, versao: string): Promise<RevisaoCenario | null> {
  const r = await c.query(
    `SELECT r.*, u.nome FROM revisoes_cenario r JOIN usuarios u ON u.id = r.usuario_id
     WHERE r.cenario_versao = $1 ORDER BY r.id DESC LIMIT 1`,
    [versao],
  );
  const x = r.rows[0];
  return x ? { cenarioVersao: x.cenario_versao, itens: x.itens, sugeridos: x.sugeridos, discordancias: x.discordancias, assinadoPor: x.nome, criadoEm: x.criado_em } : null;
}

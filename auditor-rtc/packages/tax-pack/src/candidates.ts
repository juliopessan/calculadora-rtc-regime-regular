import cenarioV1 from "../cenarios/venda-interna-v1.json" with { type: "json" };
import type { Classificacao, EngineClient } from "./engine-client.ts";

export type Candidato = Classificacao;

export type Cenario = {
  versao: string;
  revisadoPor: string | null;
  permitidos: { codigo: string; motivo: string }[];
};

export const CENARIO_VENDA_INTERNA_V1: Cenario = cenarioV1;

type Engine = Pick<EngineClient, "classificacoes" | "ncmAplicavel">;

/**
 * Candidatos válidos por NCM: classificações do motor que valem para o DF-e,
 * estão no cenário permitido e que o motor aceita para aquele NCM.
 */
export class CandidateIndex {
  /** Códigos que o motor tem mas o cenário não lista (tabela nova → revisar o cenário). */
  ignorados: string[] = [];
  private base?: Promise<Candidato[]>;
  private readonly cache = new Map<string, Promise<Candidato[]>>();
  private readonly dfe: string;
  private readonly concurrency: number;
  private readonly cenario: Cenario;
  private readonly engine: Engine;
  private readonly data: string;

  constructor(engine: Engine, data: string, opts: { dfe?: string; concurrency?: number; cenario?: Cenario } = {}) {
    this.engine = engine;
    this.data = data;
    this.dfe = opts.dfe ?? "NF-e";
    this.concurrency = opts.concurrency ?? 16;
    this.cenario = opts.cenario ?? CENARIO_VENDA_INTERNA_V1;
  }

  candidatosPara(ncm: string): Promise<Candidato[]> {
    let hit = this.cache.get(ncm);
    if (!hit) {
      hit = this.compute(ncm);
      hit.catch(() => this.cache.delete(ncm)); // falha temporária não fica no cache
      this.cache.set(ncm, hit);
    }
    return hit;
  }

  private async compute(ncm: string): Promise<Candidato[]> {
    const base = await this.carregarBase();
    const validos = await mapLimit(base, this.concurrency, (c) => this.engine.ncmAplicavel(c.codigo, ncm, this.data));
    return base.filter((_, i) => validos[i]).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  private carregarBase(): Promise<Candidato[]> {
    if (!this.base) {
      const permitidos = new Set(this.cenario.permitidos.map((p) => p.codigo));
      this.base = this.engine.classificacoes(this.data).then((all) => {
        const doDfe = all.filter((c) => c.dfes.includes(this.dfe));
        this.ignorados = all.filter((c) => !permitidos.has(c.codigo)).map((c) => c.codigo).sort();
        return doDfe.filter((c) => permitidos.has(c.codigo));
      });
      this.base.catch(() => (this.base = undefined));
    }
    return this.base;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

import type { Candidato } from "./candidates.ts";
import type { EngineClient, ResultadoItem } from "./engine-client.ts";

export type Verificacao = {
  ok: boolean;
  estadoItem: ResultadoItem["estadoItem"];
  erros: ResultadoItem["erros"];
  memoriaCalculo?: string;
  motorVersao: string;
};

export type ContextoVerificacao = { data: string; municipio: number; uf: string; motorVersao: string };

/** Base fixa: a verificação checa consistência do enquadramento, não o valor do imposto. */
const BASE_VERIFICACAO = 100;

export async function verificar(
  engine: Pick<EngineClient, "calcularItem">,
  ncm: string,
  c: Candidato,
  ctx: ContextoVerificacao,
): Promise<Verificacao> {
  const r = await engine.calcularItem(
    { ncm, cst: c.cst, cClassTrib: c.codigo, baseCalculo: BASE_VERIFICACAO },
    ctx.data,
    ctx.municipio,
    ctx.uf,
  );
  return {
    ok: r.estadoItem === "CALCULADO" || r.estadoItem === "CALCULO_SIMULADO",
    estadoItem: r.estadoItem,
    erros: r.erros,
    ...(r.memoriaCalculo !== undefined ? { memoriaCalculo: r.memoriaCalculo } : {}),
    motorVersao: ctx.motorVersao,
  };
}

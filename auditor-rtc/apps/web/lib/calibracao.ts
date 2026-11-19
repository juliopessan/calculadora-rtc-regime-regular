import { calibrate, type CalibrationReport } from "@auditor/classifier";
import { repos, type Client } from "@auditor/db";

export const MIN_AMOSTRAS_CALIBRACAO = 300;
export const PRECISAO_ALVO = 0.99;
/** Mínimo de amostras acima do limiar para a precisão ser confiável. */
const MIN_CAUDA = 50;

export type EstadoCalibracao = { amostras: number; minimo: number; alvo: number; relatorio: CalibrationReport; limiarAtual: number | null };

export async function estadoCalibracao(c: Client): Promise<EstadoCalibracao> {
  const amostras = await repos.amostrasRotuladas(c);
  const base = calibrate(amostras, PRECISAO_ALVO, MIN_CAUDA);
  const relatorio = amostras.length >= MIN_AMOSTRAS_CALIBRACAO ? base : { ...base, threshold: null, coverageAtThreshold: 0, precisionAtThreshold: 0 };
  return { amostras: amostras.length, minimo: MIN_AMOSTRAS_CALIBRACAO, alvo: PRECISAO_ALVO, relatorio, limiarAtual: await repos.limiarEscritorio(c) };
}

export type LabeledDecision = { confidence: number; correct: boolean };

export type CalibrationReport = {
  buckets: { lo: number; hi: number; n: number; precision: number }[];
  /** Menor confiança que atinge a precisão-alvo; null = não há limiar seguro (tudo vai para revisão). */
  threshold: number | null;
  coverageAtThreshold: number;
  precisionAtThreshold: number;
};

/**
 * Escolhe o limiar de auto-aprovação a partir de um conjunto de ouro.
 * Percorre as confianças observadas da menor para a maior e para na primeira
 * cuja cauda (confiança ≥ t) tenha precisão ≥ alvo e pelo menos minSamples amostras.
 */
export function calibrate(samples: LabeledDecision[], targetPrecision: number, minSamples = 50): CalibrationReport {
  const buckets = Array.from({ length: 10 }, (_, i) => {
    const lo = i / 10;
    const hi = (i + 1) / 10;
    const inBucket = samples.filter((s) => s.confidence >= lo && (i === 9 ? s.confidence <= hi : s.confidence < hi));
    return { lo, hi, n: inBucket.length, precision: precisionOf(inBucket) };
  });

  const empty = { buckets, threshold: null, coverageAtThreshold: 0, precisionAtThreshold: 0 };
  if (samples.length < minSamples) return empty;

  const sorted = [...samples].sort((a, b) => a.confidence - b.confidence);
  const distinct = [...new Set(sorted.map((s) => s.confidence))];
  for (const t of distinct) {
    const tail = sorted.filter((s) => s.confidence >= t);
    if (tail.length < minSamples) break;
    const precision = precisionOf(tail);
    if (precision >= targetPrecision) {
      return { buckets, threshold: t, coverageAtThreshold: tail.length / samples.length, precisionAtThreshold: precision };
    }
  }
  return empty;
}

function precisionOf(xs: LabeledDecision[]): number {
  return xs.length === 0 ? 0 : xs.filter((x) => x.correct).length / xs.length;
}

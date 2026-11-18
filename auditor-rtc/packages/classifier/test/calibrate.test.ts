import { describe, it, expect } from "vitest";
import { calibrate, type LabeledDecision } from "../src/index.ts";

/** 60 amostras com confiança ≥ 0,9 (todas corretas) + 40 abaixo (metade correta). */
function amostras(): LabeledDecision[] {
  const out: LabeledDecision[] = [];
  for (let i = 0; i < 60; i++) out.push({ confidence: 0.9 + (i % 10) / 100, correct: true });
  for (let i = 0; i < 40; i++) out.push({ confidence: 0.5 + (i % 30) / 100, correct: i % 2 === 0 });
  return out;
}

describe("calibrate", () => {
  it("returns null threshold with fewer than minSamples", () => {
    const r = calibrate(amostras().slice(0, 30), 0.99);
    expect(r.threshold).toBeNull();
  });

  it("finds the lowest threshold meeting the target precision", () => {
    const r = calibrate(amostras(), 0.99);
    expect(r.threshold).toBe(0.9);
    expect(r.precisionAtThreshold).toBe(1);
  });

  it("reports coverage as the fraction auto-approved at the threshold", () => {
    const r = calibrate(amostras(), 0.99);
    expect(r.coverageAtThreshold).toBeCloseTo(0.6, 10);
  });

  it("buckets add up to the sample count", () => {
    const r = calibrate(amostras(), 0.99);
    expect(r.buckets).toHaveLength(10);
    expect(r.buckets.reduce((s, b) => s + b.n, 0)).toBe(100);
  });

  it("returns null when no threshold reaches the target", () => {
    const all = Array.from({ length: 100 }, (_, i) => ({ confidence: i / 100, correct: i % 2 === 0 }));
    expect(calibrate(all, 0.99).threshold).toBeNull();
  });
});

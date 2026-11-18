import { describe, it, expect } from "vitest";
import { margemEscritorio } from "@/lib/simulador";

describe("margemEscritorio", () => {
  it("computes revenue, cost and margin for the default scenario", () => {
    expect(margemEscritorio({ clientes: 100, precoPorCliente: 500, skusPorCliente: 800, custoPorSku: 0.25 }))
      .toEqual({ receita: 50000, custo: 20000, margem: 30000 });
  });
  it("treats negative or non-finite inputs as zero", () => {
    expect(margemEscritorio({ clientes: -5, precoPorCliente: Number.NaN, skusPorCliente: 10, custoPorSku: 1 }))
      .toEqual({ receita: 0, custo: 0, margem: 0 });
  });
});

export type EntradaSimulador = { clientes: number; precoPorCliente: number; skusPorCliente: number; custoPorSku: number };

const n = (x: number) => (Number.isFinite(x) && x > 0 ? x : 0);

/** Receita do escritório revendendo a revisão de cadastro e custo do serviço por SKU. */
export function margemEscritorio(i: EntradaSimulador): { receita: number; custo: number; margem: number } {
  const clientes = n(i.clientes);
  const receita = clientes * n(i.precoPorCliente);
  const custo = clientes * n(i.skusPorCliente) * n(i.custoPorSku);
  return { receita, custo, margem: receita - custo };
}

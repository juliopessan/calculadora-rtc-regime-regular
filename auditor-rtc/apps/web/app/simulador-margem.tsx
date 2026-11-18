"use client";
import { useState } from "react";
import { margemEscritorio, type EntradaSimulador } from "@/lib/simulador";
import s from "./landing.module.css";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const CAMPOS: { k: keyof EntradaSimulador; rotulo: string; passo: number }[] = [
  { k: "clientes", rotulo: "Clientes na carteira", passo: 1 },
  { k: "precoPorCliente", rotulo: "Preço da revisão por cliente (R$)", passo: 50 },
  { k: "skusPorCliente", rotulo: "SKUs por cliente", passo: 50 },
  { k: "custoPorSku", rotulo: "Custo por SKU (R$, hipotético)", passo: 0.05 },
];

export function SimuladorMargem() {
  const [v, setV] = useState<EntradaSimulador>({ clientes: 100, precoPorCliente: 500, skusPorCliente: 800, custoPorSku: 0.25 });
  const r = margemEscritorio(v);
  return (
    <div className={s.simulador}>
      <div className={s.simCampos}>
        {CAMPOS.map((c) => (
          <div className="campo" key={c.k}>
            <label htmlFor={c.k}>{c.rotulo}</label>
            <input id={c.k} type="number" min={0} step={c.passo} value={v[c.k]} onChange={(e) => setV({ ...v, [c.k]: Number(e.target.value) })} />
          </div>
        ))}
      </div>
      <dl className={s.simResultado} aria-live="polite">
        <div><dt>Receita do escritório</dt><dd>{brl(r.receita)}</dd></div>
        <div><dt>Custo do serviço</dt><dd>{brl(r.custo)}</dd></div>
        <div className={s.destaque}><dt>Margem</dt><dd>{brl(r.margem)}</dd></div>
      </dl>
    </div>
  );
}

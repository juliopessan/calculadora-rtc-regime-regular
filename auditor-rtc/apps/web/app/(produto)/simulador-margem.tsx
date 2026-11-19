"use client";
import { useState } from "react";
import { margemEscritorio, type EntradaSimulador } from "@/lib/simulador";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const CAMPOS: { k: keyof EntradaSimulador; rotulo: string; passo: number }[] = [
  { k: "clientes", rotulo: "Clientes na carteira", passo: 1 },
  { k: "precoPorCliente", rotulo: "Preço da revisão por cliente (R$)", passo: 50 },
  { k: "skusPorCliente", rotulo: "SKUs por cliente", passo: 50 },
  { k: "custoPorSku", rotulo: "Custo por SKU (R$)", passo: 0.05 },
];

export function SimuladorMargem() {
  const [v, setV] = useState<EntradaSimulador>({ clientes: 100, precoPorCliente: 500, skusPorCliente: 800, custoPorSku: 0.25 });
  const r = margemEscritorio(v);
  return (
    <div className="block">
      <div className="block__head"><h3 className="h3">Simulador de margem do escritório</h3><span className="badge">modelo</span></div>
      <div className="block__body">
        <div className="cells cells--4">
          {CAMPOS.map((c) => (
            <div className="field" key={c.k} style={{ padding: 16, background: "var(--paper)" }}>
              <label htmlFor={c.k}>{c.rotulo}</label>
              <input className="input" id={c.k} type="number" inputMode="decimal" min={0} step={c.passo} value={v[c.k]} onChange={(e) => setV({ ...v, [c.k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="cells cells--3" style={{ marginTop: 16 }} aria-live="polite">
          <div className="kpi"><div className="kpi__label">Receita do escritório</div><div className="kpi__n tnum">{brl(r.receita)}</div></div>
          <div className="kpi kpi--cost"><div className="kpi__label">Custo do serviço</div><div className="kpi__n tnum">{brl(r.custo)}</div></div>
          <div className="kpi kpi--save"><div className="kpi__label">Margem</div><div className="kpi__n tnum">{brl(r.margem)}</div></div>
        </div>
        <p className="hint" style={{ marginTop: 12 }}>Modelo com valores que você informa. Preço por cliente: R$ 500 é a referência citada pela imprensa do setor; o custo por SKU é hipotético até o piloto.</p>
      </div>
    </div>
  );
}

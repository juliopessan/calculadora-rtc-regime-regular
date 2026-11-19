import { ROTULO_STATUS_SKU } from "@/lib/rotulos";
import { Icone } from "./ledger-icons";

/** Status = ícone de forma distinta + palavra + tinta (nunca só cor). */
export function SeloSku({ status }: { status: string }) {
  const r = ROTULO_STATUS_SKU[status] ?? { texto: status, tom: "neutro" as const, icone: "info" };
  const cls = r.tom === "ok" ? "badge badge--ok" : r.tom === "err" ? "badge badge--err" : "badge";
  return <span className={cls}><Icone nome={r.icone} />{r.texto}</span>;
}

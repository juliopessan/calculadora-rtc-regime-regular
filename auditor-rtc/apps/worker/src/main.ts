import { FakeBackend, JevBackend, type DecisionBackend } from "@auditor/classifier";
import { EngineClient } from "@auditor/tax-pack";
import { createDb } from "@auditor/db";
import { processarLote, reivindicarProximoLote } from "./process-lote.ts";

const required = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} não definida`);
  return v;
};

const db = createDb({ appUrl: required("DATABASE_URL_APP"), workerUrl: required("DATABASE_URL_WORKER") });
const engine = new EngineClient({ baseUrl: required("ENGINE_URL") });
const backend: DecisionBackend = process.env.CLASSIFIER_BACKEND === "fake" ? new FakeBackend() : new JevBackend();
const intervalMs = Number(process.env.WORKER_POLL_MS ?? 5000);

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => (stopping = true));

console.log(`[worker] backend=${backend.name} engine=${process.env.ENGINE_URL}`);
while (!stopping) {
  const next = await reivindicarProximoLote(db).catch((err) => (console.error("[worker] erro ao buscar lote:", err.message), null));
  if (!next) {
    await new Promise((r) => setTimeout(r, intervalMs));
    continue;
  }
  try {
    const r = await processarLote(db, next.loteId, { backend, engine });
    console.log(`[worker] lote ${next.loteId}: ${r.processados} processados, ${r.temporarios} temporários`);
  } catch (err) {
    console.error(`[worker] lote ${next.loteId} falhou:`, (err as Error).message);
    await db.withSystem((c) => c.query("UPDATE lotes SET status = 'NA_FILA' WHERE id = $1", [next.loteId])).catch(() => {});
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
await db.close();

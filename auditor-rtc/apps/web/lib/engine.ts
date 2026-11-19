import { EngineClient } from "@auditor/tax-pack";

let engine: EngineClient | undefined;

/** Cliente do motor oficial para telas que mostram descrições das tabelas (ENGINE_URL). */
export function getEngine(): EngineClient | null {
  const url = process.env.ENGINE_URL;
  if (!url) return null;
  engine ??= new EngineClient({ baseUrl: url });
  return engine;
}

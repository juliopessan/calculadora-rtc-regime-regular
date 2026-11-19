import { getDb } from "@/lib/db";
import { exigirSessao, jsonResp, rota } from "@/lib/auth";
import { estadoCalibracao } from "@/lib/calibracao";

export const GET = rota(async (req) => {
  const s = await exigirSessao(req);
  return jsonResp(200, await getDb().withTenant(s.escritorioId, (c) => estadoCalibracao(c)));
});

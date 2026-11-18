import { cookieLimpo } from "@/lib/session";
import { jsonResp, rota } from "@/lib/auth";

export const POST = rota(async () => jsonResp(200, { ok: true }, { "Set-Cookie": cookieLimpo() }));

import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

/** Aplica, em ordem e uma única vez, os arquivos migrations/NNN_*.sql. Roda como dona do esquema. */
export async function migrate(ownerUrl: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (nome text PRIMARY KEY, aplicado_em timestamptz NOT NULL DEFAULT now())");
    const done = new Set((await client.query<{ nome: string }>("SELECT nome FROM schema_migrations")).rows.map((r) => r.nome));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
    const applied: string[] = [];
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, f), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (nome) VALUES ($1)", [f]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`migração ${f} falhou: ${(err as Error).message}`);
      }
      applied.push(f);
    }
    return applied;
  } finally {
    await client.end();
  }
}

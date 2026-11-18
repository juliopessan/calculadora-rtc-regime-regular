import pg from "pg";
import { randomBytes } from "node:crypto";
import { createDb, type Db } from "../src/index.ts";
import { migrate } from "../src/migrate.ts";

/** Cria um banco novo e migrado no Postgres de testes (scripts/test-db.sh). */
export async function createTestDb(): Promise<{ db: Db; ownerUrl: string; drop: () => Promise<void> }> {
  const base = process.env.DATABASE_URL ?? "postgres://postgres@localhost:55432/auditor_test";
  const name = `auditor_t_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: base });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const swap = (url: string) => url.replace(/\/[^/]+$/, `/${name}`);
  const ownerUrl = swap(base);
  await migrate(ownerUrl);
  const db = createDb({
    appUrl: swap(process.env.DATABASE_URL_APP ?? "postgres://auditor_app:auditor_app@localhost:55432/x"),
    workerUrl: swap(process.env.DATABASE_URL_WORKER ?? "postgres://auditor_worker:auditor_worker@localhost:55432/x"),
  });
  return {
    db,
    ownerUrl,
    drop: async () => {
      await db.close();
      const a = new pg.Client({ connectionString: base });
      await a.connect();
      await a.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await a.end();
    },
  };
}

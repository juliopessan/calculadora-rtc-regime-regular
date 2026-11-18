import { createDb, type Db } from "@auditor/db";

let instance: Db | undefined;

/** Conexão do app (role auditor_app, sujeita a RLS). Nunca usa a conexão do worker. */
export function getDb(): Db {
  if (!instance) {
    const appUrl = process.env.DATABASE_URL_APP;
    if (!appUrl) throw new Error("DATABASE_URL_APP não definida");
    instance = createDb({ appUrl });
  }
  return instance;
}

export function setDbForTests(db: Db): void {
  instance = db;
}

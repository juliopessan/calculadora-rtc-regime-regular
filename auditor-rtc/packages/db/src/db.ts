import pg from "pg";
import { randomUUID } from "node:crypto";

export type Papel = "socio" | "contador_responsavel" | "analista";
export type Client = pg.PoolClient;

export type UsuarioAuth = { id: string; escritorioId: string; senhaHash: string; nome: string; papel: Papel };

export type Db = {
  /** Executa fn numa transação em que o RLS só enxerga o escritório informado. */
  withTenant<T>(escritorioId: string, fn: (c: Client) => Promise<T>): Promise<T>;
  /** Só para o worker: conexão com BYPASSRLS. */
  withSystem<T>(fn: (c: Client) => Promise<T>): Promise<T>;
  criarEscritorioComSocio(i: { escritorio: string; nome: string; email: string; senhaHash: string }): Promise<{ escritorioId: string; usuarioId: string }>;
  buscarUsuarioPorEmail(email: string): Promise<UsuarioAuth | null>;
  /** Resolve token público → escritório/lote, só para lotes concluídos. */
  resolverTokenRelatorio(token: string): Promise<{ escritorioId: string; loteId: string } | null>;
  close(): Promise<void>;
};

export function createDb(opts: { appUrl: string; workerUrl?: string }): Db {
  const app = new pg.Pool({ connectionString: opts.appUrl, max: 10 });
  let worker: pg.Pool | undefined;

  async function tx<T>(pool: pg.Pool, escritorioId: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      if (escritorioId) await c.query("SELECT set_config('app.escritorio_id', $1, true)", [escritorioId]);
      const out = await fn(c);
      await c.query("COMMIT");
      return out;
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }

  const db: Db = {
    withTenant: (escritorioId, fn) => {
      if (!/^[0-9a-f-]{36}$/i.test(escritorioId)) throw new Error("escritório inválido");
      return tx(app, escritorioId, fn);
    },
    withSystem: (fn) => {
      if (!opts.workerUrl) throw new Error("DATABASE_URL_WORKER não configurada");
      worker ??= new pg.Pool({ connectionString: opts.workerUrl, max: 10 });
      return tx(worker, null, fn);
    },
    async criarEscritorioComSocio(i) {
      const escritorioId = randomUUID();
      try {
        return await tx(app, escritorioId, async (c) => {
          await c.query("INSERT INTO escritorios (id, nome) VALUES ($1, $2)", [escritorioId, i.escritorio]);
          const u = await c.query<{ id: string }>(
            "INSERT INTO usuarios (escritorio_id, email, senha_hash, nome, papel) VALUES ($1, lower($2), $3, $4, 'socio') RETURNING id",
            [escritorioId, i.email, i.senhaHash, i.nome],
          );
          return { escritorioId, usuarioId: u.rows[0]!.id };
        });
      } catch (err) {
        if ((err as { code?: string }).code === "23505") throw new Error("e-mail já cadastrado");
        throw err;
      }
    },
    async buscarUsuarioPorEmail(email) {
      const r = await app.query("SELECT * FROM auth_buscar_usuario($1)", [email]);
      const u = r.rows[0];
      return u ? { id: u.id, escritorioId: u.escritorio_id, senhaHash: u.senha_hash, nome: u.nome, papel: u.papel } : null;
    },
    async resolverTokenRelatorio(token) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const r = await app.query("SELECT * FROM relatorio_por_token($1)", [token]);
      const row = r.rows[0];
      return row ? { escritorioId: row.escritorio_id, loteId: row.lote_id } : null;
    },
    async close() {
      await app.end();
      await worker?.end();
    },
  };
  return db;
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Supabase Postgres prin pooler-ul de TRANZACȚII (port 6543), cu driverul
// node-postgres (`pg`).
// - Pooler-ul de SESIUNE (5432) are limită dură de 15 clienți pe free →
//   serverless-ul îl epuiza (EMAXCONNSESSION) și paginile dinamice picau.
// - Tranzacții (6543) multiplexează mulți clienți pe puține conexiuni server.
// - postgres.js îngheța pe 6543 la reutilizarea conexiunii (pipeline-ul lui e
//   incompatibil cu transaction pooling). node-postgres NU face pipelining —
//   fiecare query e o tranzacție curată, exact ce așteaptă pooler-ul. E driverul
//   recomandat pentru pgbouncer/Supavisor.
// search_path e setat ca DEFAULT PE ROL în Supabase
// (`ALTER ROLE postgres SET search_path TO ericcosulea, public`).

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _pool: Pool | undefined;
let _db: DrizzleDb | undefined;

function getPool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 15_000,
    });
  }
  return _pool;
}

export function getDb(): DrizzleDb {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

// SQL brut cu parametri poziționali ($1,$2…) → rows[], pentru agregările din
// lib/analytics. Array-urile se serializează ca literal Postgres `{...}` (cast-urile
// `$N::timestamptz[]` din query le parsează) — robust indiferent de driver.
function toPgArrayLiteral(arr: unknown[]): string {
  return (
    "{" +
    arr
      .map((v) =>
        v === null || v === undefined
          ? "NULL"
          : `"${String(v).replace(/(["\\])/g, "\\$1")}"`,
      )
      .join(",") +
    "}"
  );
}

export async function sqlQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const prepared = params.map((p) => (Array.isArray(p) ? toPgArrayLiteral(p) : p));
  const res = await getPool().query(text, prepared);
  return res.rows as T[];
}

// Lazy proxy — backward compatible cu toate import { db } existente
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop: string | symbol) {
    return Reflect.get(getDb(), prop);
  },
});

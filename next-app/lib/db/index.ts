import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Supabase Postgres prin pooler-ul de tranzacții (port 6543). Tabelele stau în
// schema `ericcosulea` (izolată de deep-work care e în `public`). search_path-ul
// e setat ca DEFAULT PE ROL în Supabase (`ALTER ROLE postgres SET search_path TO
// ericcosulea, public`), NU ca parametru de startup pe conexiune: pooler-ul de
// tranzacții (Supavisor) se împiedica de startup param sub concurență → pagini
// cu multe query-uri paralele (ex. pnlpersonal) picau intermitent 500/timeout.
// Default-ul pe rol se aplică server-side pe fiecare conexiune, fiabil.
//
// prepare:false e obligatoriu pe pooler-ul de tranzacții (nu suportă prepared
// statements).

type Sql = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _client: Sql | undefined;
let _db: DrizzleDb | undefined;

export function getClient(): Sql {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _client = postgres(url, {
      ssl: "require",
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }
  return _client;
}

export function getDb(): DrizzleDb {
  if (!_db) _db = drizzle(getClient(), { schema });
  return _db;
}

// SQL brut cu parametri poziționali ($1,$2…) → rows[]. Înlocuiește neon .query()
// pentru agregările din lib/analytics; folosește același client (search_path).
//
// Array-urile se serializează ca literal Postgres `{...}`: driverul neon accepta
// un array JS ca parametru `type[]`, dar postgres.js nu (aruncă „Received an
// instance of Array" prin .unsafe). Cu cast-urile `$N::timestamptz[]` din query,
// literalul se parsează corect.
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

export function sqlQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const prepared = params.map((p) => (Array.isArray(p) ? toPgArrayLiteral(p) : p));
  return getClient().unsafe(text, prepared as never[]) as unknown as Promise<T[]>;
}

// Lazy proxy — backward compatible cu toate import { db } existente
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop: string | symbol) {
    return Reflect.get(getDb(), prop);
  },
});

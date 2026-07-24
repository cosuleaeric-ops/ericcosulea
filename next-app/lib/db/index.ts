import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Supabase Postgres prin pooler-ul de tranzacții (port 6543). Tabelele stau în
// schema `ericcosulea` (izolată de deep-work care e în `public`), setată prin
// search_path pe conexiune — așa atât query-urile Drizzle cât și SQL-ul brut
// (ex. view-ul events_human) rezolvă necalificat în schema noastră.
//
// prepare:false e obligatoriu pe pooler-ul de tranzacții (nu suportă prepared
// statements). DB_SEARCH_PATH lipsă → comportament standard (public), ca la
// rollback pe Neon codul să meargă fără modificări.

type Sql = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _client: Sql | undefined;
let _db: DrizzleDb | undefined;

export function getClient(): Sql {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    const searchPath = process.env.DB_SEARCH_PATH;
    _client = postgres(url, {
      ssl: "require",
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 15,
      ...(searchPath ? { connection: { search_path: searchPath } } : {}),
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
export function sqlQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return getClient().unsafe(text, params as never[]) as unknown as Promise<T[]>;
}

// Lazy proxy — backward compatible cu toate import { db } existente
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop: string | symbol) {
    return Reflect.get(getDb(), prop);
  },
});

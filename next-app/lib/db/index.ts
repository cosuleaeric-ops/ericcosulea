import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Supabase Postgres prin pooler-ul de SESIUNE (port 5432). Tabelele stau în
// schema `ericcosulea` (izolată de deep-work din `public`); search_path setat ca
// DEFAULT PE ROL în Supabase (`ALTER ROLE postgres SET search_path TO
// ericcosulea, public`), aplicat server-side pe fiecare conexiune.
//
// De ce sesiune (5432) și NU tranzacții (6543): pooler-ul de tranzacții +
// postgres.js îngheață query-urile la reutilizarea conexiunii (prima cerere
// merge, următoarele pe aceeași instanță warm dau statement timeout / atârnă).
// Pooler-ul de sesiune ține o conexiune stabilă și reutilizabilă — reuse-ul
// merge instant. La traficul redus de aici, numărul de conexiuni nu e o
// problemă (Postgres are 60). prepare:false rămâne, inofensiv.

type Sql = ReturnType<typeof postgres>;
type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _client: Sql | undefined;
let _db: DrizzleDb | undefined;

export function getClient(): Sql {
  if (!_client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    // Config minimal recomandat de Supabase pentru serverless: prepare:false
    // (obligatoriu pe pooler-ul de tranzacții). max:5 lasă build-ul să
    // prerandeze paginile ISR în paralel; FĂRĂ idle_timeout, conexiunile rămân
    // calde între request-uri (reuse) — stabilirea unei conexiuni noi spre
    // Supavisor e lentă, deci reconectările dese (idle_timeout mic) provocau
    // exact timeout-urile intermitente.
    _client = postgres(url, {
      ssl: "require",
      prepare: false,
      max: 5,
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

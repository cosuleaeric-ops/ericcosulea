import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Retry pe erori de rețea tranzitorii ("fetch failed") — altfel un singur blip
// spre Neon în timpul unui build (prerender blog) pică tot deploy-ul. Reîncercăm
// doar când fetch-ul ARUNCĂ (niciun răspuns primit), nu pe status-uri HTTP.
neonConfig.fetchFunction = async (input: unknown, init: unknown) => {
  const MAX = 4;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      return await fetch(input as RequestInfo, init as RequestInit);
    } catch (err) {
      if (attempt === MAX) throw err;
      await new Promise((r) => setTimeout(r, 250 * attempt)); // 250/500/750ms
    }
  }
  throw new Error("unreachable");
};

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _db: DrizzleDb | undefined;

export function getDb(): DrizzleDb {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

// Lazy proxy — backward compatible cu toate import { db } existente
export const db = new Proxy({} as DrizzleDb, {
  get(_, prop: string | symbol) {
    return Reflect.get(getDb(), prop);
  },
});

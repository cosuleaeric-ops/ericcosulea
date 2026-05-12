import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

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

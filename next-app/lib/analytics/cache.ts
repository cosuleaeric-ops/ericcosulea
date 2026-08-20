import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Cache partajat pentru rezultatele dashboardului.
 *
 * De ce nu ajunge unul în memorie: pe Vercel rulează mai multe instanțe, iar
 * două încărcări una după alta nimeresc de obicei instanțe diferite. Măsurat pe
 * 21 aug 2026, cache-ul din memorie lăsa paginile la 2,3-5s, fiindcă fiecare
 * cerere găsea o instanță cu cache gol.
 *
 * Baza e la o latență de ~45ms caldă, față de 3-4s cât ia PostHog să rescaneze
 * evenimentele de la zero. E un schimb bun chiar și când baza e rece (~350ms).
 */

const TABEL = sql`ericcosulea.analytics_cache`;
let pregatit = false;

async function pregateste(): Promise<void> {
  if (pregatit) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ${TABEL} (
      cheie text PRIMARY KEY,
      date jsonb NOT NULL,
      expira timestamptz NOT NULL
    )`);
  pregatit = true;
}

export function cheieCache(parti: unknown): string {
  return crypto.createHash("sha1").update(JSON.stringify(parti)).digest("hex");
}

/**
 * Cât ține un rezultat.
 *
 * O perioadă ÎNCHISĂ (luna trecută, anul trecut) nu se mai schimbă niciodată,
 * deci poate sta o zi. Una care atinge prezentul trebuie să rămână proaspătă,
 * dar 90 de secunde sunt sub pragul la care ai observa ceva pe un dashboard.
 */
export function durata(pana: Date): number {
  const inchisa = Date.now() - pana.getTime() > 3600_000;
  return inchisa ? 86_400 : 90;
}

export async function citeste<T>(cheie: string): Promise<T | null> {
  try {
    await pregateste();
    const r = await db.execute(
      sql`SELECT date FROM ${TABEL} WHERE cheie = ${cheie} AND expira > now() LIMIT 1`,
    );
    const rand = (r as unknown as { rows?: { date: unknown }[] }).rows?.[0];
    return rand ? (rand.date as T) : null;
  } catch {
    // Cache-ul nu are voie să doboare dashboardul: la orice problemă,
    // interogăm PostHog ca înainte.
    return null;
  }
}

export async function scrie(cheie: string, date: unknown, secunde: number): Promise<void> {
  try {
    await pregateste();
    await db.execute(sql`
      INSERT INTO ${TABEL} (cheie, date, expira)
      VALUES (${cheie}, ${JSON.stringify(date)}::jsonb, now() + make_interval(secs => ${secunde}))
      ON CONFLICT (cheie) DO UPDATE SET date = EXCLUDED.date, expira = EXCLUDED.expira`);
  } catch {
    /* vezi mai sus */
  }
}

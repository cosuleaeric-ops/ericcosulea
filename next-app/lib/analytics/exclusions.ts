import "server-only";
import { desc, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { analyticsExcludedIps } from "@/lib/db/schema";

// Auto-excluderea propriilor vizite (vezi comentariul de la tabel în schema.ts).
// Lista se ține în memorie 60s: /api/event e pe calea critică a fiecărui
// pageview și nu merită un query în plus pe request.

const TTL_MS = 60 * 1000;
const MAX_AGE_DAYS = 30;
const RECORD_THROTTLE_MS = 10 * 60 * 1000;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

let cache: Set<string> | null = null;
let fetchedAt = 0;
const recorded = new Map<string, number>();

export function clientIp(h: Headers): string | null {
  const fwd = h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
}

/** IP-urile mele active. Fail-open: la eroare de DB nu excludem nimic. */
export async function excludedIps(): Promise<Set<string>> {
  if (cache && Date.now() - fetchedAt < TTL_MS) return cache;
  try {
    const rows = await db
      .select({ ip: analyticsExcludedIps.ip })
      .from(analyticsExcludedIps)
      .where(gt(analyticsExcludedIps.lastSeenAt, new Date(Date.now() - MAX_AGE_MS)));
    cache = new Set(rows.map((r) => r.ip));
    fetchedAt = Date.now();
  } catch {
    if (!cache) cache = new Set();
  }
  return cache;
}

/** Marchează IP-ul curent ca fiind al meu. Apelat din dashboard-ul /elitedata. */
export async function recordOwnIp(ip: string | null): Promise<void> {
  if (!ip) return;
  const last = recorded.get(ip) ?? 0;
  if (Date.now() - last < RECORD_THROTTLE_MS) return;
  recorded.set(ip, Date.now());
  try {
    await db
      .insert(analyticsExcludedIps)
      .values({ ip })
      .onConflictDoUpdate({
        target: analyticsExcludedIps.ip,
        set: { lastSeenAt: new Date() },
      });
    cache = null; // forțează reîncărcarea listei la următorul event
  } catch {
    recorded.delete(ip); // n-a intrat în DB → reîncearcă la următoarea vizită
  }
}

/** Lista de afișat în Settings (inclusiv cele expirate, ca să se vadă de ce). */
export async function listExcludedIps(): Promise<
  { ip: string; lastSeenAt: Date; active: boolean }[]
> {
  const rows = await db
    .select({ ip: analyticsExcludedIps.ip, lastSeenAt: analyticsExcludedIps.lastSeenAt })
    .from(analyticsExcludedIps)
    .orderBy(desc(analyticsExcludedIps.lastSeenAt));
  const cutoff = Date.now() - MAX_AGE_MS;
  return rows.map((r) => ({ ...r, active: r.lastSeenAt.getTime() > cutoff }));
}

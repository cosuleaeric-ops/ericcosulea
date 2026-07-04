// Sursă externă de conversii: pentru un site configurat (ex. cesaicumpar.ro),
// tragem numărul REAL de click-uri afiliat din API-ul lui (deja filtrat de boți /
// gest-uman), în loc să ne bazăm pe evenimentele noastre. Config prin env, ca să
// nu hardcodăm site-ul: GOAL_API_SITE (publicId), GOAL_API_URL, GOAL_API_SECRET.

export type GoalApiConfig = { url: string; secret: string };

export function goalApiFor(publicId: string): GoalApiConfig | null {
  if (!publicId || publicId !== process.env.GOAL_API_SITE) return null;
  const url = process.env.GOAL_API_URL;
  const secret = process.env.GOAL_API_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

// Timestamp-urile (ms, crescător) conversiilor în [from, to). Rezilient: la orice
// eroare / timeout → [] (dashboard-ul nu pică dacă API-ul extern e picat).
export async function fetchExternalClickTimes(
  cfg: GoalApiConfig,
  from: Date,
  to: Date,
): Promise<number[]> {
  const u = new URL(cfg.url);
  u.searchParams.set("from", from.toISOString());
  u.searchParams.set("to", to.toISOString());
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(u, {
      headers: { "x-api-key": cfg.secret },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { timestamps?: unknown };
    const ts = Array.isArray(j.timestamps)
      ? (j.timestamps.filter((n) => typeof n === "number") as number[])
      : [];
    return ts.sort((a, b) => a - b);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// Câte timestamp-uri (sortate) cad în fiecare bucket [start[i], start[i+1]) —
// ultimul bucket se închide la `endMs`. Folosim EXACT granițele seriei existente.
export function bucketCounts(
  startIsos: string[],
  endMs: number,
  sortedTimes: number[],
): number[] {
  const starts = startIsos.map((s) => new Date(s).getTime());
  const counts = new Array(starts.length).fill(0);
  let j = 0;
  for (let i = 0; i < starts.length; i++) {
    const lo = starts[i];
    const hi = i + 1 < starts.length ? starts[i + 1] : endMs;
    while (j < sortedTimes.length && sortedTimes[j] < lo) j++;
    let c = 0;
    while (j < sortedTimes.length && sortedTimes[j] < hi) {
      c++;
      j++;
    }
    counts[i] = c;
  }
  return counts;
}

export function countInRange(times: number[], from: Date, to: Date): number {
  const lo = from.getTime();
  const hi = to.getTime();
  let c = 0;
  for (const t of times) if (t >= lo && t < hi) c++;
  return c;
}

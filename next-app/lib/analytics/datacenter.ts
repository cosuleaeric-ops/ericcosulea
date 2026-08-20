import "server-only";

// Detecție IP-uri de datacenter (AWS, GCP, Azure, OVH, Hetzner, DO...).
// Boții care rulează un Chrome real cu UA curat trec de filtrul de user-agent
// din /api/event; singurul semnal rămas e că vin din IP-uri de cloud, nu
// rezidențiale. Evenimentele lor NU se aruncă: se marchează is_datacenter=true
// și graficele citesc view-ul events_human (WHERE NOT is_datacenter).
//
// Surse: lista agregată X4BNet (github.com/X4BNet/lists_vpn, un CIDR IPv4 pe
// linie) + lista oficială Google Cloud (X4BNet nu acoperă blocul 34.64.0.0/10).
// Se descarcă lazy la primul event al instanței și se țin în memorie 24h.
// Fail-open: dacă fetch-ul pică, nimic nu e marcat (mai bine zgomot în grafic
// decât vizitatori reali pierduți).

const SOURCES: { url: string; parse: (body: string) => string[] }[] = [
  {
    url: "https://raw.githubusercontent.com/X4BNet/lists_vpn/main/output/datacenter/ipv4.txt",
    parse: (body) => body.split("\n"),
  },
  {
    url: "https://www.gstatic.com/ipranges/cloud.json",
    parse: (body) =>
      (JSON.parse(body).prefixes as { ipv4Prefix?: string }[])
        .map((p) => p.ipv4Prefix ?? ""),
  },
];
const TTL_OK_MS = 24 * 60 * 60 * 1000;
const TTL_FAIL_MS = 10 * 60 * 1000; // după un fetch eșuat, reîncearcă repede

type IpRange = { start: number; end: number };

let ranges: IpRange[] = [];
let fetchedAt = 0;
let lastTtl = 0;
let inflight: Promise<void> | null = null;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = n * 256 + b;
  }
  return n; // 0 .. 2^32-1, ca number (safe: sub 2^53)
}

function parseCidrs(lines: string[]): IpRange[] {
  const out: IpRange[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const [ip, bitsStr] = s.split("/");
    const base = ipv4ToInt(ip);
    if (base == null) continue;
    const bits = bitsStr === undefined ? 32 : Number(bitsStr);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) continue;
    const size = 2 ** (32 - bits);
    const start = Math.floor(base / size) * size; // aliniat la granița blocului
    out.push({ start, end: start + size - 1 });
  }
  return out;
}

// Sortare + merge (listele au blocuri adiacente/suprapuse) → binary search curat.
function mergeRanges(out: IpRange[]): IpRange[] {
  out.sort((a, b) => a.start - b.start);
  const merged: IpRange[] = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 1) {
      if (r.end > last.end) last.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

async function refresh(): Promise<void> {
  const results = await Promise.allSettled(
    SOURCES.map(async (s) => {
      const res = await fetch(s.url, {
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${s.url}: HTTP ${res.status}`);
      return parseCidrs(s.parse(await res.text()));
    }),
  );
  const all: IpRange[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
    else console.error("datacenter: sursă CIDR eșuată (fail-open)", r.reason);
  }
  const merged = mergeRanges(all);
  if (merged.length >= 1000) {
    ranges = merged;
    lastTtl = TTL_OK_MS;
  } else {
    console.error(`datacenter: listă suspect de mică (${merged.length}), păstrez ce aveam`);
    lastTtl = TTL_FAIL_MS;
  }
  fetchedAt = Date.now();
}

async function ensureFresh(): Promise<void> {
  if (Date.now() - fetchedAt < lastTtl) return;
  if (!inflight) {
    inflight = refresh().finally(() => {
      inflight = null;
    });
  }
  // Doar primul apel al instanței așteaptă; la reîmprospătări avem deja o listă
  // veche utilizabilă, dar aici latența nu contează (beacon fire-and-forget).
  await inflight;
}

export async function isDatacenterIp(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const n = ipv4ToInt(ip.trim());
  if (n == null) return false; // IPv6 / nevalid: fail-open
  await ensureFresh();
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (n < r.start) hi = mid - 1;
    else if (n > r.end) lo = mid + 1;
    else return true;
  }
  return false;
}

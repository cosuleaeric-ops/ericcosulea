import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { randomUUID, createDecipheriv, createHash } from "crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, lt } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { events, websites } from "../lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

function decrypt(b64: string): string {
  const key = createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest();
  const buf = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

// domeniu -> GA4 property id
const MAP: { domain: string; property: string }[] = [
  { domain: "cesaicumpar.ro", property: "320110335" },
  { domain: "ericcosulea.ro", property: "356877740" },
  { domain: "cursurilapahar.ro", property: "517968547" },
  // outglow.ro (GA4 540765338) SCOS din 10 iul 2026: are trackerul EliteData
  // instalat direct (dfid_dad7610368); importul i-ar șterge datele first-party.
];

const START = "2023-01-01";
function yesterday(): string {
  const d = new Date(Date.now() - 86400000);
  return d.toISOString().slice(0, 10);
}

const rand = (n: number) => Math.floor(Math.random() * n);
function weightedPick<T>(items: { v: T; w: number }[]): T | null {
  const total = items.reduce((s, i) => s + i.w, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) if ((r -= it.w) <= 0) return it.v;
  return items[items.length - 1].v;
}

function mapSource(src: string, medium: string): { source: string; raw: string | null } {
  const s = (src || "").toLowerCase();
  if (!s || s === "(direct)" || s === "(none)" || s === "(not set)")
    return { source: "Direct/None", raw: null };
  const table: [RegExp, string][] = [
    [/google/, "Google"], [/bing/, "Bing"], [/yahoo/, "Yahoo"], [/duckduckgo/, "DuckDuckGo"],
    [/facebook|fb\.com|l\.facebook/, "Facebook"], [/instagram/, "Instagram"],
    [/t\.co|twitter|x\.com/, "Twitter/X"], [/linkedin|lnkd/, "LinkedIn"], [/reddit/, "Reddit"],
    [/youtube|youtu\.be/, "YouTube"], [/tiktok/, "TikTok"], [/chatgpt|openai/, "ChatGPT"],
    [/pinterest/, "Pinterest"], [/telegram|t\.me/, "Telegram"],
  ];
  for (const [re, name] of table) if (re.test(s)) return { source: name, raw: `https://${s}/` };
  return { source: s.replace(/^www\./, ""), raw: `https://${s}/` };
}

function mapOs(os: string): string {
  if (/Macintosh|Mac OS/i.test(os)) return "macOS";
  return os || "Unknown";
}

type Report = { rows: { dims: string[]; mets: number[] }[] };
async function runReport(property: string, body: object, token: string): Promise<Report> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`runReport ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] };
  return { rows: (j.rows ?? []).map((r) => ({ dims: r.dimensionValues.map((d) => d.value), mets: r.metricValues.map((m) => Number(m.value)) })) };
}

function gaDateToTs(d: string): number {
  // "YYYYMMDD" -> UTC mid-day randomizat (6..20h) ca să cadă în ziua locală corectă
  const y = +d.slice(0, 4), mo = +d.slice(4, 6) - 1, da = +d.slice(6, 8);
  return Date.UTC(y, mo, da, 6 + rand(14), rand(60), rand(60));
}

type EventRow = typeof events.$inferInsert;

async function importSite(websiteId: number, domain: string, property: string, token: string) {
  const end = yesterday();
  // Report A: joint principal
  const A = await runReport(property, {
    dateRanges: [{ startDate: START, endDate: end }],
    dimensions: ["date", "sessionSource", "sessionMedium", "countryId", "deviceCategory"].map((name) => ({ name })),
    metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
    limit: 250000,
  }, token);
  // Report B: pagini per zi
  const B = await runReport(property, {
    dateRanges: [{ startDate: START, endDate: end }],
    dimensions: ["date", "pagePath"].map((name) => ({ name })),
    metrics: [{ name: "screenPageViews" }],
    limit: 250000,
  }, token);
  // Report C: browser/os per zi
  const C = await runReport(property, {
    dateRanges: [{ startDate: START, endDate: end }],
    dimensions: ["date", "browser", "operatingSystem"].map((name) => ({ name })),
    metrics: [{ name: "sessions" }],
    limit: 250000,
  }, token);

  // distribuții per zi
  const pagesByDate = new Map<string, { v: string; w: number }[]>();
  for (const r of B.rows) {
    const [date, path] = r.dims;
    if (!path || !path.startsWith("/")) continue;
    (pagesByDate.get(date) ?? pagesByDate.set(date, []).get(date)!).push({ v: path, w: r.mets[0] });
  }
  const techByDate = new Map<string, { v: { browser: string; os: string }; w: number }[]>();
  for (const r of C.rows) {
    const [date, browser, os] = r.dims;
    (techByDate.get(date) ?? techByDate.set(date, []).get(date)!).push({ v: { browser: browser || "Unknown", os: mapOs(os) }, w: r.mets[0] });
  }

  const rows: EventRow[] = [];
  let totalSessions = 0;
  for (const r of A.rows) {
    const [date, src, medium, countryId, device] = r.dims;
    const sessions = r.mets[0];
    const pageviews = Math.max(sessions, r.mets[1]);
    if (sessions <= 0) continue;
    totalSessions += sessions;
    const { source, raw } = mapSource(src, medium);
    const utmMedium = medium && !/\(none\)|\(not set\)/.test(medium) ? medium : null;
    const utmSource = utmMedium && /cpc|ppc|paid|email|social/.test(utmMedium) ? src : null;
    const country = countryId && countryId !== "(not set)" ? countryId : null;
    const pagePool = pagesByDate.get(date) ?? [];
    const techPool = techByDate.get(date) ?? [];

    // distribuie pageview-urile pe sesiuni
    const base = Math.floor(pageviews / sessions);
    let extra = pageviews - base * sessions;
    for (let i = 0; i < sessions; i++) {
      const pv = Math.max(1, base + (extra-- > 0 ? 1 : 0));
      const visitorId = randomUUID();
      const sessionId = randomUUID();
      const tech = weightedPick(techPool) ?? { browser: "Unknown", os: "Unknown" };
      const isBounce = pv === 1;
      let t = gaDateToTs(date);
      for (let p = 0; p < pv; p++) {
        const path = weightedPick(pagePool) ?? "/";
        rows.push({
          websiteId, type: "pageview", name: null, path, hostname: domain,
          referrerRaw: raw, referrerSource: source, utmSource, utmMedium, utmCampaign: null,
          country, region: null, city: null, browser: tech.browser, os: tech.os, device: device || "desktop",
          visitorId, sessionId, isBounce, durationSeconds: 0, createdAt: new Date(t),
        });
        t += (20 + rand(130)) * 1000;
      }
    }
  }

  // șterge event-urile istorice (înainte de azi) DOAR pe acest site -> idempotent,
  // păstrează datele reale de azi încolo.
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  await db
    .delete(events)
    .where(and(eq(events.websiteId, websiteId), lt(events.createdAt, startToday)));

  for (let i = 0; i < rows.length; i += 500) await db.insert(events).values(rows.slice(i, i + 500));
  console.log(`  ${domain}: ${totalSessions} sesiuni -> ${rows.length} events (până la ${end})`);
}

async function main() {
  const [g] = await sql`SELECT access_token FROM integrations_gsc ORDER BY connected_at DESC LIMIT 1`;
  const token = decrypt(g.access_token as string);
  for (const m of MAP) {
    const [site] = await db.select({ id: websites.id }).from(websites).where(eq(websites.domain, m.domain)).limit(1);
    if (!site) { console.log(`skip ${m.domain} (nu există)`); continue; }
    try {
      await importSite(site.id, m.domain, m.property, token);
    } catch (e) {
      console.error(`  EROARE ${m.domain}:`, (e as Error).message);
    }
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

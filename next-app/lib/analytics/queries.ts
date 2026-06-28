import "server-only";
import { and, eq, gte, lt, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, websites } from "@/lib/db/schema";
import {
  type Range,
  type Granularity,
  bucketStarts,
  formatBucketLabel,
  previousRange,
} from "./range";
import { channelOf } from "./parse";

export type Filters = {
  path?: string;
  hostname?: string;
  country?: string;
  region?: string;
  city?: string;
  source?: string;
  device?: string;
  os?: string;
  browser?: string;
  channel?: string;
  campaign?: string;
};

export const FILTER_KEYS: (keyof Filters)[] = [
  "path",
  "hostname",
  "country",
  "region",
  "city",
  "source",
  "device",
  "os",
  "browser",
  "channel",
  "campaign",
];

export type EventLite = {
  visitorId: string | null;
  sessionId: string | null;
  createdAt: Date;
  type: string;
  name: string | null;
  path: string | null;
  hostname: string | null;
  isBounce: boolean;
  referrerSource: string | null;
  referrerRaw: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export async function getWebsiteByPublicId(publicId: string) {
  const rows = await db
    .select()
    .from(websites)
    .where(eq(websites.publicId, publicId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listWebsites() {
  return db.select().from(websites).orderBy(websites.createdAt);
}

export async function fetchEvents(
  websiteId: number,
  range: Range,
): Promise<EventLite[]> {
  return db
    .select({
      visitorId: events.visitorId,
      sessionId: events.sessionId,
      createdAt: events.createdAt,
      type: events.type,
      name: events.name,
      path: events.path,
      hostname: events.hostname,
      isBounce: events.isBounce,
      referrerSource: events.referrerSource,
      referrerRaw: events.referrerRaw,
      country: events.country,
      region: events.region,
      city: events.city,
      browser: events.browser,
      os: events.os,
      device: events.device,
      utmSource: events.utmSource,
      utmMedium: events.utmMedium,
      utmCampaign: events.utmCampaign,
    })
    .from(events)
    .where(
      and(
        eq(events.websiteId, websiteId),
        gte(events.createdAt, range.from),
        lt(events.createdAt, range.to),
      ),
    );
}

// Filtrele se aplică în JS (channel e derivat, nu coloană) — fetch-ul aduce
// oricum toate rândurile pentru agregare.
function rowChannel(r: EventLite): string {
  return channelOf(r.referrerSource ?? "Direct/None", r.utmMedium);
}

export function applyFilters(rows: EventLite[], f: Filters): EventLite[] {
  const active = FILTER_KEYS.filter((k) => f[k]);
  if (!active.length) return rows;
  return rows.filter((r) => {
    if (f.path && r.path !== f.path) return false;
    if (f.hostname && r.hostname !== f.hostname) return false;
    if (f.country && r.country !== f.country) return false;
    if (f.region && r.region !== f.region) return false;
    if (f.city && r.city !== f.city) return false;
    if (f.source && r.referrerSource !== f.source) return false;
    if (f.device && r.device !== f.device) return false;
    if (f.os && r.os !== f.os) return false;
    if (f.browser && r.browser !== f.browser) return false;
    if (f.campaign && r.utmCampaign !== f.campaign) return false;
    if (f.channel && rowChannel(r) !== f.channel) return false;
    return true;
  });
}

// ───────────────────────── KPI ─────────────────────────
export type Kpis = {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounceRate: number; // 0..100
  sessionTime: number; // secunde
  conversions: number;
  conversionRate: number; // 0..100
  kpi1Name: string | null;
  kpi1Value: number | null;
};

export function computeKpis(
  rows: EventLite[],
  kpiGoalName: string | null,
): Kpis {
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  const sessionSpan = new Map<string, { min: number; max: number }>();
  const convVisitors = new Set<string>();
  let pageviews = 0;
  let kpi1Value = 0;

  for (const r of rows) {
    if (r.visitorId) visitors.add(r.visitorId);
    if (r.sessionId) {
      sessions.add(r.sessionId);
      const t = r.createdAt.getTime();
      const cur = sessionSpan.get(r.sessionId);
      if (!cur) sessionSpan.set(r.sessionId, { min: t, max: t });
      else {
        if (t < cur.min) cur.min = t;
        if (t > cur.max) cur.max = t;
      }
    }
    if (r.type === "pageview") pageviews++;
    if (r.type === "custom") {
      const isConv = kpiGoalName ? r.name === kpiGoalName : true;
      if (isConv) {
        if (r.visitorId) convVisitors.add(r.visitorId);
        if (!kpiGoalName || r.name === kpiGoalName) kpi1Value++;
      }
    }
  }

  // bounce = sesiune cu un singur event (durată 0); calculat pe span, robust.
  let bounce = 0;
  let totalDur = 0;
  for (const [, span] of sessionSpan) {
    const dur = (span.max - span.min) / 1000;
    totalDur += dur;
    if (dur === 0) bounce++;
  }

  const sessionsN = sessions.size;
  return {
    visitors: visitors.size,
    sessions: sessionsN,
    pageviews,
    bounceRate: sessionsN ? (bounce / sessionsN) * 100 : 0,
    sessionTime: sessionsN ? totalDur / sessionsN : 0,
    conversions: convVisitors.size,
    conversionRate: visitors.size ? (convVisitors.size / visitors.size) * 100 : 0,
    kpi1Name: kpiGoalName,
    kpi1Value: kpiGoalName ? kpi1Value : null,
  };
}

function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null; // null = "new" (fără bază)
  return ((cur - prev) / prev) * 100;
}

export type Deltas = {
  visitors: number | null;
  conversionRate: number | null;
  bounceRate: number | null;
  sessionTime: number | null;
  kpi1: number | null;
};

export function computeDeltas(cur: Kpis, prev: Kpis): Deltas {
  return {
    visitors: pctDelta(cur.visitors, prev.visitors),
    conversionRate: pctDelta(cur.conversionRate, prev.conversionRate),
    bounceRate: pctDelta(cur.bounceRate, prev.bounceRate),
    sessionTime: pctDelta(cur.sessionTime, prev.sessionTime),
    kpi1: pctDelta(cur.kpi1Value ?? 0, prev.kpi1Value ?? 0),
  };
}

// ───────────────────────── Series ─────────────────────────
export type SeriesPoint = { t: string; label: string; value: number };

export function computeSeries(
  rows: EventLite[],
  range: Range,
  g: Granularity,
  tz: string,
): SeriesPoint[] {
  const starts = bucketStarts(range, g);
  const ms = starts.map((d) => d.getTime());
  const sets: Array<Set<string>> = starts.map(() => new Set());

  // ultimul bucket cu start <= t (suportă bucket-uri de lățime variabilă: lună)
  const idxFor = (t: number): number => {
    let lo = 0;
    let hi = ms.length - 1;
    let res = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ms[mid] <= t) {
        res = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return res;
  };

  for (const r of rows) {
    if (!r.visitorId) continue;
    const idx = idxFor(r.createdAt.getTime());
    if (idx < 0) continue;
    sets[idx].add(r.visitorId);
  }

  return starts.map((d, i) => ({
    t: d.toISOString(),
    label: formatBucketLabel(d, g, tz),
    value: sets[i].size,
  }));
}

// Online = vizitatori distincți în ultimele 5 minute (independent de range).
export async function getOnline(websiteId: number): Promise<number> {
  const since = new Date(Date.now() - 5 * 60 * 1000);
  const rows = await db
    .select({ v: events.visitorId })
    .from(events)
    .where(and(eq(events.websiteId, websiteId), gt(events.createdAt, since)));
  return new Set(rows.map((r) => r.v)).size;
}

// ───────────────────────── Breakdowns ─────────────────────────
export type BreakdownRow = { key: string; value: number };
export type Breakdowns = {
  channel: BreakdownRow[];
  referrer: BreakdownRow[];
  campaign: BreakdownRow[];
  page: BreakdownRow[];
  hostname: BreakdownRow[];
  entry: BreakdownRow[];
  exit: BreakdownRow[];
  country: BreakdownRow[];
  region: BreakdownRow[];
  city: BreakdownRow[];
  browser: BreakdownRow[];
  os: BreakdownRow[];
  device: BreakdownRow[];
};

const TOP_N = 100;

// Rank după vizitatori distincți per cheie.
function rankVisitors(
  rows: EventLite[],
  keyFn: (r: EventLite) => string | null | undefined,
): BreakdownRow[] {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = keyFn(r);
    if (k == null || k === "") continue;
    const vid = r.visitorId ?? r.sessionId ?? "?";
    let s = m.get(k);
    if (!s) {
      s = new Set();
      m.set(k, s);
    }
    s.add(vid);
  }
  return [...m.entries()]
    .map(([key, set]) => ({ key, value: set.size }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);
}

// Entry/exit page: prima/ultima pagină pe sesiune, numărate ca sesiuni.
function rankEntryExit(rows: EventLite[], which: "first" | "last"): BreakdownRow[] {
  const bySession = new Map<string, { t: number; path: string }>();
  for (const r of rows) {
    if (r.type !== "pageview" || !r.sessionId || !r.path) continue;
    const t = r.createdAt.getTime();
    const cur = bySession.get(r.sessionId);
    if (!cur) bySession.set(r.sessionId, { t, path: r.path });
    else if (which === "first" ? t < cur.t : t > cur.t) {
      cur.t = t;
      cur.path = r.path;
    }
  }
  const m = new Map<string, number>();
  for (const { path } of bySession.values()) m.set(path, (m.get(path) ?? 0) + 1);
  return [...m.entries()]
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N);
}

export function computeBreakdowns(rows: EventLite[]): Breakdowns {
  return {
    channel: rankVisitors(rows, rowChannel),
    referrer: rankVisitors(rows, (r) => r.referrerSource ?? "Direct/None"),
    campaign: rankVisitors(rows, (r) => r.utmCampaign),
    page: rankVisitors(rows, (r) => r.path),
    hostname: rankVisitors(rows, (r) => r.hostname),
    entry: rankEntryExit(rows, "first"),
    exit: rankEntryExit(rows, "last"),
    country: rankVisitors(rows, (r) => r.country),
    region: rankVisitors(rows, (r) => r.region),
    city: rankVisitors(rows, (r) => r.city),
    browser: rankVisitors(rows, (r) => r.browser),
    os: rankVisitors(rows, (r) => r.os),
    device: rankVisitors(rows, (r) => r.device),
  };
}

// ───────────────────────── Payload complet ─────────────────────────
export type StatsPayload = {
  kpis: Kpis;
  deltas: Deltas;
  online: number;
  series: SeriesPoint[];
  compareSeries: SeriesPoint[] | null;
  breakdowns: Breakdowns;
};

export async function getStats(opts: {
  websiteId: number;
  kpiGoalName: string | null;
  tz: string;
  range: Range;
  granularity: Granularity;
  compare: boolean;
  filters: Filters;
}): Promise<StatsPayload> {
  const prev = previousRange(opts.range);
  const [curRaw, prevRaw, online] = await Promise.all([
    fetchEvents(opts.websiteId, opts.range),
    fetchEvents(opts.websiteId, prev),
    getOnline(opts.websiteId),
  ]);

  const curRows = applyFilters(curRaw, opts.filters);
  const prevRows = applyFilters(prevRaw, opts.filters);

  const kpis = computeKpis(curRows, opts.kpiGoalName);
  const prevKpis = computeKpis(prevRows, opts.kpiGoalName);
  const series = computeSeries(curRows, opts.range, opts.granularity, opts.tz);
  const compareSeries = opts.compare
    ? computeSeries(prevRows, prev, opts.granularity, opts.tz)
    : null;

  return {
    kpis,
    deltas: computeDeltas(kpis, prevKpis),
    online,
    series,
    compareSeries,
    breakdowns: computeBreakdowns(curRows),
  };
}

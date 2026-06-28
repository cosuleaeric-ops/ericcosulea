import "server-only";
import { and, eq, gte, lt, gt, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, websites } from "@/lib/db/schema";
import {
  type Range,
  type Granularity,
  bucketStarts,
  formatBucketLabel,
  previousRange,
} from "./range";

export type Filters = {
  path?: string;
  country?: string;
  source?: string;
  device?: string;
  os?: string;
  browser?: string;
  channel?: string;
};

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

function filterConds(websiteId: number, range: Range, f: Filters): SQL[] {
  const conds: SQL[] = [
    eq(events.websiteId, websiteId),
    gte(events.createdAt, range.from),
    lt(events.createdAt, range.to),
  ];
  if (f.path) conds.push(eq(events.path, f.path));
  if (f.country) conds.push(eq(events.country, f.country));
  if (f.source) conds.push(eq(events.referrerSource, f.source));
  if (f.device) conds.push(eq(events.device, f.device));
  if (f.os) conds.push(eq(events.os, f.os));
  if (f.browser) conds.push(eq(events.browser, f.browser));
  return conds;
}

export async function fetchEvents(
  websiteId: number,
  range: Range,
  f: Filters = {},
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
    .where(and(...filterConds(websiteId, range, f)));
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

// ───────────────────────── Payload complet ─────────────────────────
export type StatsPayload = {
  kpis: Kpis;
  deltas: Deltas;
  online: number;
  series: SeriesPoint[];
  compareSeries: SeriesPoint[] | null;
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
  const [curRows, prevRows, online] = await Promise.all([
    fetchEvents(opts.websiteId, opts.range, opts.filters),
    fetchEvents(opts.websiteId, prev, opts.filters),
    getOnline(opts.websiteId),
  ]);

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
  };
}

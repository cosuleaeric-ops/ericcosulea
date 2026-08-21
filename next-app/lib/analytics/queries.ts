import "server-only";
import { eq } from "drizzle-orm";
import { db, sqlQuery } from "@/lib/db";
import { websites, goals, funnels } from "@/lib/db/schema";
import { getStatsPosthog, getOverviewPosthog, DIMENSIUNI_FILTRABILE } from "./posthog";
import {
  type Range,
  type Granularity,
  bucketStarts,
  formatBucketLabel,
  previousRange,
} from "./range";

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

// Prinde la pornire nepotrivirea care a făcut filtrul pe referrer să nu
// filtreze nimic: cheia pleca din interfață ca `source`, dar dimensiunea era
// înregistrată doar ca `referrer`, iar condiția o ignora tăcut. Aici se vede
// imediat, nu după ce te uiți la cifre greșite.
{
  const lipsa = FILTER_KEYS.filter((k) => !DIMENSIUNI_FILTRABILE.includes(k));
  if (lipsa.length > 0) {
    throw new Error(
      `FILTER_KEYS fără dimensiune în posthog.ts: ${lipsa.join(", ")}`,
    );
  }
}

// ───────────────────────── tipuri publice (neschimbate) ─────────────────────────
export type Kpis = {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  sessionTime: number;
  conversions: number;
  conversionRate: number;
  kpi1Name: string | null;
  kpi1Value: number | null;
};

export type Deltas = {
  visitors: number | null;
  conversionRate: number | null;
  bounceRate: number | null;
  sessionTime: number | null;
  kpi1: number | null;
};

export type SeriesPoint = {
  t: string;
  label: string;
  value: number;
  newValue?: number;
  returningValue?: number;
  goalValue?: number; // conversii ale KPI-ului #1 în bucket (bara portocalie)
  spikeSource?: string | null; // sursa dominantă în zilele cu spike de trafic
};
export type BreakdownRow = { key: string; value: number; conv?: number };
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
export type GoalRow = { name: string; displayName: string; count: number; rate: number };
export type FunnelStep = { label: string; count: number };
export type FunnelData = { name: string; steps: FunnelStep[] } | null;
export type UserRow = {
  id: string;
  country: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  referrerSource: string | null;
  sessions: number;
  pageviews: number;
  duration: number; // secunde, suma duratelor sesiunilor din perioadă
  lastSeen: string;
};
export type JourneyRow = {
  id: string;
  country: string | null;
  device: string | null;
  startedAt: string;
  pages: string[];
};
export type StatsPayload = {
  kpis: Kpis;
  deltas: Deltas;
  online: number;
  series: SeriesPoint[];
  compareSeries: SeriesPoint[] | null;
  breakdowns: Breakdowns;
  goals: GoalRow[];
  funnel: FunnelData;
  users: UserRow[];
  journeys: JourneyRow[];
};
export type OverviewSite = {
  publicId: string;
  domain: string;
  faviconUrl: string | null;
  visitors: number;
  spark: number[];
};

// ───────────────────────── website helpers ─────────────────────────
export async function getWebsiteByPublicId(publicId: string) {
  const rows = await db.select().from(websites).where(eq(websites.publicId, publicId)).limit(1);
  return rows[0] ?? null;
}
export async function listWebsites() {
  return db.select().from(websites).orderBy(websites.createdAt);
}

// ───────────────────────── helpers ─────────────────────────
function pctDelta(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}
export function computeDeltas(cur: Kpis, prev: Kpis): Deltas {
  return {
    visitors: pctDelta(cur.visitors, prev.visitors),
    conversionRate: pctDelta(cur.conversionRate, prev.conversionRate),
    bounceRate: pctDelta(cur.bounceRate, prev.bounceRate),
    sessionTime: pctDelta(cur.sessionTime, prev.sessionTime),
    kpi1: pctDelta(cur.kpi1Value ?? 0, prev.kpi1Value ?? 0),
  };
}

export async function getStats(opts: {
  websiteId: number;
  kpiGoalName: string | null;
  tz: string;
  range: Range;
  granularity: Granularity;
  compare: boolean;
  filters: Filters;
}): Promise<StatsPayload> {
  // Datele vin din PostHog de pe 20 aug 2026 (înainte: tabela `events` a
  // noastră). Dashboard-ul e neschimbat, doar sursa s-a mutat, deci funcția
  // păstrează exact aceeași semnătură și același payload.
  const site = (await db.select().from(websites).where(eq(websites.id, opts.websiteId)).limit(1))[0];
  if (!site) throw new Error(`Site inexistent: ${opts.websiteId}`);

  const p = await getStatsPosthog({ ...opts, domeniu: site.domain });

  return {
    kpis: p.kpis,
    deltas: computeDeltas(p.kpis, p.prev),
    online: p.online,
    series: p.series,
    compareSeries: p.compareSeries,
    breakdowns: p.breakdowns,
    goals: p.goals,
    funnel: null,
    users: p.users,
    journeys: p.journeys,
  };
}

// ───────────────────────── Overview (toate site-urile) ─────────────────────────
export async function getOverview(
  range: Range,
  granularity: Granularity,
): Promise<{ totalVisitors: number; sites: OverviewSite[] }> {
  const all = await db.select().from(websites).orderBy(websites.createdAt);
  if (!all.length) return { totalVisitors: 0, sites: [] };

  // Vizitatorii vin din PostHog (20 aug 2026); lista de site-uri, favicon-urile
  // și ordinea rămân la noi, în tabela `websites`.
  const peDomeniu = await getOverviewPosthog(
    all.map((s) => s.domain),
    range,
    granularity,
    "Europe/Bucharest",
  );

  const sites: OverviewSite[] = all.map((s) => {
    const d = peDomeniu.get(s.domain.replace(/^www\./, "")) ?? { visitors: 0, spark: [] };
    return {
      publicId: s.publicId,
      domain: s.domain,
      faviconUrl: s.faviconUrl,
      visitors: d.visitors,
      spark: d.spark,
    };
  });

  return {
    totalVisitors: sites.reduce((sum, s) => sum + s.visitors, 0),
    sites,
  };
}

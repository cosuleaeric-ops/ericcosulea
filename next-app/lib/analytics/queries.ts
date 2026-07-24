import "server-only";
import { eq } from "drizzle-orm";
import { db, sqlQuery } from "@/lib/db";
import { websites, goals, funnels } from "@/lib/db/schema";
import {
  type Range,
  type Granularity,
  bucketStarts,
  formatBucketLabel,
  previousRange,
} from "./range";

// ───────────────────────── raw SQL de agregare (în DB) ─────────────────────────
// Prin clientul postgres.js partajat din lib/db (search_path=ericcosulea).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function q<T = any>(text: string, params: unknown[]): Promise<T[]> {
  return sqlQuery<T>(text, params);
}

// channelOf(referrer_source, utm_medium) reprodus EXACT ca expresie SQL (vezi parse.ts).
const CHANNEL_CASE = `(CASE
  WHEN lower(coalesce(utm_medium,'')) LIKE '%cpc%' OR lower(coalesce(utm_medium,'')) LIKE '%ppc%' OR lower(coalesce(utm_medium,'')) LIKE '%paid%' THEN 'Paid Search'
  WHEN lower(coalesce(utm_medium,'')) LIKE '%email%' THEN 'Email'
  WHEN lower(coalesce(utm_medium,'')) LIKE '%social%' THEN 'Social'
  WHEN coalesce(referrer_source,'Direct/None') = 'Direct/None' THEN 'Direct'
  WHEN coalesce(referrer_source,'Direct/None') IN ('Google','Bing','Yahoo','DuckDuckGo','Ecosia','Yandex','Baidu') THEN 'Organic Search'
  WHEN coalesce(referrer_source,'Direct/None') IN ('Facebook','Instagram','Twitter/X','LinkedIn','Reddit','YouTube','TikTok','Pinterest','Telegram') THEN 'Social'
  ELSE 'Referral' END)`;

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

const FILTER_COLUMN: Record<string, string> = {
  path: "path",
  hostname: "hostname",
  country: "country",
  region: "region",
  city: "city",
  source: "referrer_source",
  device: "device",
  os: "os",
  browser: "browser",
  campaign: "utm_campaign",
};

// Construiește predicatele de filtrare (valori parametrizate $N; coloane din whitelist).
function buildFilterClause(f: Filters, params: unknown[]): string {
  const parts: string[] = [];
  for (const [k, col] of Object.entries(FILTER_COLUMN)) {
    const v = f[k as keyof Filters];
    if (v) {
      params.push(v);
      parts.push(`${col} = $${params.length}`);
    }
  }
  if (f.channel) {
    params.push(f.channel);
    parts.push(`${CHANNEL_CASE} = $${params.length}`);
  }
  return parts.length ? " AND " + parts.join(" AND ") : "";
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
const EMPTY_KPIS: Kpis = {
  visitors: 0,
  sessions: 0,
  pageviews: 0,
  bounceRate: 0,
  sessionTime: 0,
  conversions: 0,
  conversionRate: 0,
  kpi1Name: null,
  kpi1Value: 0,
};

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

type KpiAgg = {
  visitors: number;
  sessions: number;
  pageviews: number;
  bounced: number;
  dur_sum: number;
  conv_visitors: number;
  kpi1_value: number;
};
function kpisFromAgg(a: KpiAgg | undefined, kpiGoalName: string | null): Kpis {
  if (!a) return { ...EMPTY_KPIS, kpi1Name: kpiGoalName, kpi1Value: kpiGoalName ? 0 : null };
  const sessions = Number(a.sessions);
  const visitors = Number(a.visitors);
  return {
    visitors,
    sessions,
    pageviews: Number(a.pageviews),
    bounceRate: sessions ? (Number(a.bounced) / sessions) * 100 : 0,
    sessionTime: sessions ? Number(a.dur_sum) / sessions : 0,
    conversions: Number(a.conv_visitors),
    conversionRate: visitors ? (Number(a.conv_visitors) / visitors) * 100 : 0,
    kpi1Name: kpiGoalName,
    kpi1Value: kpiGoalName ? Number(a.kpi1_value) : null,
  };
}

// ───────────────────────── KPI bundle (cur + prev într-un round-trip) ─────────────────────────
async function fetchKpis(
  websiteId: number,
  cur: Range,
  prev: Range,
  kpiGoalName: string | null,
  filters: Filters,
): Promise<{ cur: Kpis; prev: Kpis }> {
  const params: unknown[] = [
    websiteId,
    cur.from.toISOString(),
    cur.to.toISOString(),
    prev.from.toISOString(),
    prev.to.toISOString(),
  ];
  const fc = buildFilterClause(filters, params);
  params.push(kpiGoalName);
  const k = `$${params.length}`;
  const conv = `e.type='custom' AND (${k}::text IS NULL OR e.name=${k})`;
  const text = `
WITH ev AS (
  SELECT 'cur' AS b, visitor_id, session_id, type, name, created_at FROM events_human
   WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz${fc}
  UNION ALL
  SELECT 'prev' AS b, visitor_id, session_id, type, name, created_at FROM events_human
   WHERE website_id=$1 AND created_at>=$4::timestamptz AND created_at<$5::timestamptz${fc}
),
ev_agg AS (
  SELECT b,
    count(DISTINCT visitor_id)::int AS visitors,
    count(DISTINCT session_id)::int AS sessions,
    count(*) FILTER (WHERE type='pageview')::int AS pageviews,
    count(DISTINCT visitor_id) FILTER (WHERE ${conv})::int AS conv_visitors,
    count(*) FILTER (WHERE ${conv})::int AS kpi1_value
  FROM ev e GROUP BY b
),
sess AS (
  SELECT b, session_id, EXTRACT(EPOCH FROM (max(created_at)-min(created_at))) AS dur
  FROM ev WHERE session_id IS NOT NULL GROUP BY b, session_id
),
sess_agg AS (
  SELECT b, count(*) FILTER (WHERE dur=0)::int AS bounced, coalesce(sum(dur),0)::float8 AS dur_sum
  FROM sess GROUP BY b
)
SELECT e.b, e.visitors, e.sessions, e.pageviews, e.conv_visitors, e.kpi1_value,
       coalesce(s.bounced,0)::int AS bounced, coalesce(s.dur_sum,0)::float8 AS dur_sum
FROM ev_agg e LEFT JOIN sess_agg s ON s.b=e.b`;
  const rows = await q<KpiAgg & { b: string }>(text, params);
  const curRow = rows.find((r) => r.b === "cur");
  const prevRow = rows.find((r) => r.b === "prev");
  return { cur: kpisFromAgg(curRow, kpiGoalName), prev: kpisFromAgg(prevRow, kpiGoalName) };
}

// ───────────────────────── Series (visitors per bucket) ─────────────────────────
// Bucketăm pe granițele EXACTE produse de bucketStarts (JS) — reproduce idxFor()
// pentru orice aliniere (inclusiv range-ul prev/compare care nu începe la miezul nopții).
async function fetchSeries(
  websiteId: number,
  range: Range,
  g: Granularity,
  tz: string,
  filters: Filters,
  kpiGoalName: string | null,
): Promise<SeriesPoint[]> {
  const starts = bucketStarts(range, g);
  if (!starts.length) return [];
  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  params.push(starts.map((d) => d.toISOString())); // $N = timestamptz[]
  const bndIdx = params.length;
  params.push(range.to.toISOString());
  const toIdx = params.length;
  params.push(kpiGoalName);
  const goalIdx = params.length; // NULL ⇒ goalv = 0 peste tot
  const text = `
WITH ev AS (
  SELECT visitor_id, created_at, type, name FROM events_human
  WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz AND visitor_id IS NOT NULL${fc}
),
firsts AS (
  SELECT visitor_id, min(created_at) AS first_seen FROM events_human
  WHERE website_id=$1 AND visitor_id IS NOT NULL
  GROUP BY visitor_id
),
bnd AS (
  SELECT ord-1 AS idx, lo::timestamptz AS lo,
         coalesce(lead(lo) OVER (ORDER BY ord), $${toIdx}::timestamptz) AS hi
  FROM unnest($${bndIdx}::timestamptz[]) WITH ORDINALITY AS u(lo, ord)
)
SELECT b.idx,
  count(DISTINCT ev.visitor_id)::int AS value,
  count(DISTINCT ev.visitor_id) FILTER (WHERE f.first_seen >= b.lo)::int AS newv,
  count(DISTINCT ev.visitor_id) FILTER (WHERE f.first_seen < b.lo)::int AS retv,
  count(*) FILTER (WHERE $${goalIdx}::text IS NOT NULL AND ev.type='custom' AND ev.name=$${goalIdx})::int AS goalv
FROM bnd b
LEFT JOIN ev ON ev.created_at >= b.lo AND ev.created_at < b.hi
LEFT JOIN firsts f ON f.visitor_id = ev.visitor_id
GROUP BY b.idx ORDER BY b.idx`;
  const rows = await q<{ idx: number; value: number; newv: number; retv: number; goalv: number }>(text, params);
  const byIdx = new Map(rows.map((r) => [Number(r.idx), r]));
  return starts.map((d, i) => {
    const r = byIdx.get(i);
    return {
      t: d.toISOString(),
      label: formatBucketLabel(d, g, tz),
      value: r ? Number(r.value) : 0,
      newValue: r ? Number(r.newv) : 0,
      returningValue: r ? Number(r.retv) : 0,
      goalValue: r ? Number(r.goalv) : 0,
    };
  });
}

// ───────────────────────── Spike-uri de trafic (sursa dominantă/zi) ─────────────────────────
// Un bucket e „spike" dacă depășește clar mediana seriei. Adnotăm cu sursa
// referrer dominantă din ziua aia (ca „Traffic spike from LinkedIn" în DataFast).
function detectSpikeIdx(values: number[]): number[] {
  if (values.filter((v) => v > 0).length < 4) return [];
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  // Outlier clar: peste mean+2σ, cu un prag minim absolut ca să nu marcăm zgomot.
  const threshold = Math.max(12, mean + 2 * std);
  const out: number[] = [];
  values.forEach((v, i) => {
    if (v > 0 && v >= threshold) out.push(i);
  });
  return out;
}

async function enrichSpikes(
  websiteId: number,
  range: Range,
  g: Granularity,
  filters: Filters,
  series: SeriesPoint[],
): Promise<void> {
  const spikeIdx = detectSpikeIdx(series.map((p) => p.value));
  if (!spikeIdx.length) return;

  const starts = bucketStarts(range, g);
  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  params.push(starts.map((d) => d.toISOString()));
  const bndIdx = params.length;
  params.push(range.to.toISOString());
  const toIdx = params.length;
  const text = `
WITH ev AS (
  SELECT visitor_id, created_at, coalesce(referrer_source,'Direct/None') AS src FROM events_human
  WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz AND visitor_id IS NOT NULL${fc}
),
bnd AS (
  SELECT ord-1 AS idx, lo::timestamptz AS lo,
         coalesce(lead(lo) OVER (ORDER BY ord), $${toIdx}::timestamptz) AS hi
  FROM unnest($${bndIdx}::timestamptz[]) WITH ORDINALITY AS u(lo, ord)
)
SELECT b.idx, ev.src, count(DISTINCT ev.visitor_id)::int AS v
FROM bnd b JOIN ev ON ev.created_at >= b.lo AND ev.created_at < b.hi
WHERE ev.src <> 'Direct/None'
GROUP BY b.idx, ev.src`;
  const rows = await q<{ idx: number; src: string; v: number }>(text, params);
  const top = new Map<number, { src: string; v: number }>();
  for (const r of rows) {
    const i = Number(r.idx);
    const cur = top.get(i);
    if (!cur || Number(r.v) > cur.v) top.set(i, { src: r.src, v: Number(r.v) });
  }
  for (const i of spikeIdx) {
    const t = top.get(i);
    if (t) series[i].spikeSource = t.src;
  }
}

// ───────────────────────── Breakdowns + goals (un singur scan materializat) ─────────────────────────
const DISTINCT_ID = "count(DISTINCT coalesce(visitor_id, session_id, '?'))::int";
const SIMPLE_DIMS: { dim: keyof Breakdowns; keyExpr: string; notNull?: string }[] = [
  { dim: "channel", keyExpr: CHANNEL_CASE },
  { dim: "referrer", keyExpr: "coalesce(referrer_source,'Direct/None')" },
  { dim: "campaign", keyExpr: "utm_campaign", notNull: "utm_campaign" },
  { dim: "page", keyExpr: "path", notNull: "path" },
  { dim: "hostname", keyExpr: "hostname", notNull: "hostname" },
  { dim: "country", keyExpr: "country", notNull: "country" },
  { dim: "region", keyExpr: "region", notNull: "region" },
  { dim: "city", keyExpr: "city", notNull: "city" },
  { dim: "browser", keyExpr: "browser", notNull: "browser" },
  { dim: "os", keyExpr: "os", notNull: "os" },
  { dim: "device", keyExpr: "device", notNull: "device" },
];

async function fetchBreakdownsAndGoals(
  websiteId: number,
  range: Range,
  filters: Filters,
): Promise<{ breakdowns: Breakdowns; goalsRaw: Map<string, number> }> {
  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  const branches = SIMPLE_DIMS.map((b) => {
    const where = b.notNull ? ` WHERE ${b.notNull} IS NOT NULL AND ${b.notNull} <> ''` : "";
    return `(SELECT '${b.dim}'::text dim, ${b.keyExpr} key, ${DISTINCT_ID} value FROM base${where} GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 100)`;
  });
  branches.push(
    `(SELECT 'goal'::text dim, name key, ${DISTINCT_ID} value FROM base WHERE type='custom' AND name IS NOT NULL GROUP BY 2)`,
  );
  const text = `
WITH base AS MATERIALIZED (
  SELECT visitor_id, session_id, type, name, referrer_source, utm_medium, utm_campaign,
         path, hostname, country, region, city, browser, os, device
  FROM events_human WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz${fc}
)
${branches.join("\nUNION ALL\n")}`;
  const rows = await q<{ dim: string; key: string; value: number }>(text, params);

  const breakdowns = {} as Breakdowns;
  for (const b of SIMPLE_DIMS) breakdowns[b.dim] = [];
  breakdowns.entry = [];
  breakdowns.exit = [];
  const goalsRaw = new Map<string, number>();
  for (const r of rows) {
    if (r.dim === "goal") goalsRaw.set(String(r.key), Number(r.value));
    else (breakdowns[r.dim as keyof Breakdowns] as BreakdownRow[]).push({ key: String(r.key), value: Number(r.value) });
  }
  return { breakdowns, goalsRaw };
}

// ── Atribuirea conversiilor pe dimensiuni („de unde vin cei care convertesc") ──
// Un vizitator care convertește e numărat o dată pe dimensiune, după FIRST-TOUCH
// (canal/referrer/campanie = cum a ajuns pe site) și valoarea lui (țară/browser).
// Pentru „page": total conversii per pagina unde s-a dat click (per-eveniment).
type ConvMaps = Partial<Record<keyof Breakdowns, Map<string, number>>>;
async function fetchConversionBreakdowns(
  websiteId: number,
  range: Range,
  filters: Filters,
  kpiGoalName: string | null,
): Promise<ConvMaps> {
  if (!kpiGoalName) return {};
  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  params.push(kpiGoalName);
  const g = `$${params.length}`;
  const text = `
WITH convs AS (
  SELECT DISTINCT visitor_id FROM events_human
  WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz${fc}
    AND type='custom' AND name=${g} AND visitor_id IS NOT NULL
),
ft AS (
  SELECT DISTINCT ON (e.visitor_id) e.visitor_id,
    ${CHANNEL_CASE} AS channel,
    coalesce(e.referrer_source,'Direct/None') AS referrer,
    e.utm_campaign AS campaign,
    e.country, e.region, e.city, e.browser, e.os, e.device
  FROM events_human e JOIN convs c ON c.visitor_id=e.visitor_id
  WHERE e.website_id=$1 AND e.created_at>=$2::timestamptz AND e.created_at<$3::timestamptz
  ORDER BY e.visitor_id, e.created_at ASC
)
SELECT * FROM ft`;
  const rows = await q<Record<string, string | null>>(text, params);

  const VISITOR_DIMS: (keyof Breakdowns)[] = [
    "channel", "referrer", "campaign", "country", "region", "city", "browser", "os", "device",
  ];
  const out: ConvMaps = {};
  for (const d of VISITOR_DIMS) out[d] = new Map();
  for (const r of rows) {
    for (const d of VISITOR_DIMS) {
      const v = r[d];
      if (v == null || v === "") continue;
      const m = out[d]!;
      m.set(String(v), (m.get(String(v)) ?? 0) + 1);
    }
  }

  // „page": conversii per pagina unde s-a dat click (total, per-eveniment).
  // `${fc}` folosește parametrul filtrului ($4+) — altfel node-postgres crapă cu
  // 42P18 „could not determine data type" pe param nefolosit — și ține numărătoarea
  // consistentă cu CTE-ul `convs`, care filtrează același set de evenimente.
  const pageRows = await q<{ key: string; n: number }>(
    `SELECT path AS key, count(*)::int n FROM events_human
     WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz${fc}
       AND type='custom' AND name=${g} AND path IS NOT NULL AND path <> ''
     GROUP BY path`,
    params,
  );
  out.page = new Map(pageRows.map((r) => [String(r.key), Number(r.n)]));
  return out;
}

function mergeConv(breakdowns: Breakdowns, conv: ConvMaps): void {
  for (const dim of Object.keys(conv) as (keyof Breakdowns)[]) {
    const m = conv[dim];
    const rows = breakdowns[dim];
    if (!m || !rows) continue;
    for (const row of rows) row.conv = m.get(row.key) ?? 0;
  }
}

async function fetchEntryExit(
  websiteId: number,
  range: Range,
  filters: Filters,
): Promise<{ entry: BreakdownRow[]; exit: BreakdownRow[] }> {
  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  const text = `
WITH pv AS MATERIALIZED (
  SELECT session_id, path, created_at, id FROM events_human
  WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz
    AND type='pageview' AND session_id IS NOT NULL AND path IS NOT NULL${fc}
),
firsts AS (SELECT DISTINCT ON (session_id) session_id, path FROM pv ORDER BY session_id, created_at ASC, id ASC),
lasts  AS (SELECT DISTINCT ON (session_id) session_id, path FROM pv ORDER BY session_id, created_at DESC, id DESC)
(SELECT 'entry'::text dim, path key, count(*)::int value FROM firsts GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 100)
UNION ALL
(SELECT 'exit'::text dim, path key, count(*)::int value FROM lasts GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 100)`;
  const rows = await q<{ dim: string; key: string; value: number }>(text, params);
  const entry: BreakdownRow[] = [];
  const exit: BreakdownRow[] = [];
  for (const r of rows) (r.dim === "entry" ? entry : exit).push({ key: String(r.key), value: Number(r.value) });
  return { entry, exit };
}

function mergeGoals(
  defs: { name: string; displayName: string | null }[],
  goalsRaw: Map<string, number>,
  totalVisitors: number,
): GoalRow[] {
  if (!defs.length) return [];
  return defs
    .map((d) => {
      const count = goalsRaw.get(d.name) ?? 0;
      return { name: d.name, displayName: d.displayName ?? d.name, count, rate: totalVisitors ? (count / totalVisitors) * 100 : 0 };
    })
    .sort((a, b) => b.count - a.count);
}

async function fetchFunnel(websiteId: number, range: Range, filters: Filters): Promise<FunnelData> {
  const defs = await db
    .select({ name: funnels.name, steps: funnels.steps })
    .from(funnels)
    .where(eq(funnels.websiteId, websiteId))
    .limit(1);
  const def = defs[0];
  const steps = def?.steps as { type: string; value: string }[] | undefined;
  if (!def || !steps?.length) return null;

  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  const bools: string[] = [];
  steps.forEach((s) => {
    params.push(s.value);
    const idx = params.length;
    if (s.type === "path") bools.push(`bool_or(type='pageview' AND path=$${idx}) AS s${bools.length}`);
    else bools.push(`bool_or(type='custom' AND name=$${idx}) AS s${bools.length}`);
  });
  // cumulative AND counts
  const counts = steps
    .map((_, i) => {
      const cond = Array.from({ length: i + 1 }, (_, j) => `s${j}`).join(" AND ");
      return `count(*) FILTER (WHERE ${cond})::int AS c${i}`;
    })
    .join(",\n  ");
  const text = `
WITH reach AS (
  SELECT coalesce(visitor_id, session_id) AS vid,
    ${bools.join(",\n    ")}
  FROM events_human
  WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz AND coalesce(visitor_id,session_id) IS NOT NULL${fc}
  GROUP BY 1
)
SELECT
  ${counts}
FROM reach`;
  const rows = await q<Record<string, number>>(text, params);
  const r = rows[0] ?? {};
  return {
    name: def.name,
    steps: steps.map((s, i) => ({ label: s.value, count: Number(r[`c${i}`] ?? 0) })),
  };
}

async function fetchUsers(websiteId: number, range: Range, filters: Filters): Promise<UserRow[]> {
  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  const text = `
WITH per AS (
  SELECT visitor_id,
    count(DISTINCT session_id)::int AS sessions,
    count(*) FILTER (WHERE type='pageview')::int AS pageviews,
    max(created_at) AS last_seen
  FROM events_human
  WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz AND visitor_id IS NOT NULL${fc}
  GROUP BY visitor_id ORDER BY last_seen DESC LIMIT 30
),
latest AS (
  SELECT DISTINCT ON (e.visitor_id) e.visitor_id, e.country, e.device, e.os, e.browser
  FROM events_human e JOIN per USING (visitor_id)
  WHERE e.website_id=$1 AND e.created_at>=$2::timestamptz AND e.created_at<$3::timestamptz
  ORDER BY e.visitor_id, e.created_at DESC, e.id DESC
),
firstref AS (
  SELECT DISTINCT ON (e.visitor_id) e.visitor_id, e.referrer_source
  FROM events_human e JOIN per USING (visitor_id)
  WHERE e.website_id=$1 AND e.created_at>=$2::timestamptz AND e.created_at<$3::timestamptz
  ORDER BY e.visitor_id, e.created_at ASC, e.id ASC
)
SELECT p.visitor_id AS id, l.country, l.device, l.os, l.browser,
       f.referrer_source AS "referrerSource", p.sessions, p.pageviews, p.last_seen AS "lastSeen"
FROM per p JOIN latest l USING (visitor_id) JOIN firstref f USING (visitor_id)
ORDER BY p.last_seen DESC`;
  type Row = Omit<UserRow, "lastSeen"> & { lastSeen: string | Date };
  const rows = await q<Row>(text, params);
  return rows.map((r) => ({ ...r, lastSeen: new Date(r.lastSeen).toISOString() }));
}

async function fetchJourneys(websiteId: number, range: Range, filters: Filters): Promise<JourneyRow[]> {
  const params: unknown[] = [websiteId, range.from.toISOString(), range.to.toISOString()];
  const fc = buildFilterClause(filters, params);
  const text = `
WITH pv AS (
  SELECT session_id, path, created_at, id, country, device,
         min(created_at) OVER (PARTITION BY session_id) AS started_at
  FROM events_human
  WHERE website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz
    AND type='pageview' AND session_id IS NOT NULL AND path IS NOT NULL${fc}
),
top AS (
  SELECT session_id, started_at FROM (SELECT DISTINCT session_id, started_at FROM pv) d
  ORDER BY started_at DESC LIMIT 30
)
SELECT pv.session_id AS id, min(pv.started_at) AS "startedAt",
       (array_agg(pv.country ORDER BY pv.created_at ASC, pv.id ASC))[1] AS country,
       (array_agg(pv.device  ORDER BY pv.created_at ASC, pv.id ASC))[1] AS device,
       array_agg(pv.path ORDER BY pv.created_at ASC, pv.id ASC) AS pages
FROM pv JOIN top USING (session_id)
GROUP BY pv.session_id ORDER BY "startedAt" DESC`;
  type Row = { id: string; startedAt: string | Date; country: string | null; device: string | null; pages: string[] };
  const rows = await q<Row>(text, params);
  return rows.map((r) => ({
    id: r.id,
    country: r.country,
    device: r.device,
    startedAt: new Date(r.startedAt).toISOString(),
    pages: r.pages ?? [],
  }));
}

// ───────────────────────── Crawlere AI ─────────────────────────
export type CrawlerStats = {
  total: number;
  uniqueCrawlers: number;
  byCrawler: { key: string; category: string; value: number }[];
  byCategory: { key: string; value: number }[];
  byPath: { key: string; value: number }[];
};

export async function getCrawlerStats(
  websiteId: number,
  range: Range,
): Promise<CrawlerStats> {
  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const win = `website_id=$1 AND created_at>=$2::timestamptz AND created_at<$3::timestamptz`;
  const params = [websiteId, from, to];

  const [totals, byCrawler, byCategory, byPath] = await Promise.all([
    q<{ total: number; uniq: number }>(
      `SELECT count(*)::int AS total, count(DISTINCT crawler)::int AS uniq FROM crawler_events WHERE ${win}`,
      params,
    ),
    q<{ key: string; category: string; value: number }>(
      `SELECT crawler AS key, max(category) AS category, count(*)::int AS value
       FROM crawler_events WHERE ${win} GROUP BY crawler ORDER BY value DESC LIMIT 100`,
      params,
    ),
    q<{ key: string; value: number }>(
      `SELECT category AS key, count(*)::int AS value
       FROM crawler_events WHERE ${win} GROUP BY category ORDER BY value DESC`,
      params,
    ),
    q<{ key: string; value: number }>(
      `SELECT coalesce(path, '/') AS key, count(*)::int AS value
       FROM crawler_events WHERE ${win} GROUP BY path ORDER BY value DESC LIMIT 100`,
      params,
    ),
  ]);

  return {
    total: Number(totals[0]?.total ?? 0),
    uniqueCrawlers: Number(totals[0]?.uniq ?? 0),
    byCrawler: byCrawler.map((r) => ({ key: r.key, category: r.category, value: Number(r.value) })),
    byCategory: byCategory.map((r) => ({ key: r.key, value: Number(r.value) })),
    byPath: byPath.map((r) => ({ key: r.key, value: Number(r.value) })),
  };
}

export async function getOnline(websiteId: number): Promise<number> {
  const rows = await q<{ n: number }>(
    `SELECT count(DISTINCT visitor_id)::int AS n FROM events_human WHERE website_id=$1 AND created_at > now() - interval '5 minutes'`,
    [websiteId],
  );
  return Number(rows[0]?.n ?? 0);
}

// ───────────────────────── Payload complet ─────────────────────────
export async function getStats(opts: {
  websiteId: number;
  kpiGoalName: string | null;
  tz: string;
  range: Range;
  granularity: Granularity;
  compare: boolean;
  filters: Filters;
}): Promise<StatsPayload> {
  const { websiteId, kpiGoalName, tz, range, granularity, compare, filters } = opts;
  const prev = previousRange(range);

  const [kpiPair, series, compareSeries, bg, entryExit, convBd, online, funnel, users, journeys, goalDefs] =
    await Promise.all([
      fetchKpis(websiteId, range, prev, kpiGoalName, filters),
      fetchSeries(websiteId, range, granularity, tz, filters, kpiGoalName),
      compare ? fetchSeries(websiteId, prev, granularity, tz, filters, kpiGoalName) : Promise.resolve(null),
      fetchBreakdownsAndGoals(websiteId, range, filters),
      fetchEntryExit(websiteId, range, filters),
      fetchConversionBreakdowns(websiteId, range, filters, kpiGoalName),
      getOnline(websiteId),
      fetchFunnel(websiteId, range, filters),
      fetchUsers(websiteId, range, filters),
      fetchJourneys(websiteId, range, filters),
      db.select({ name: goals.name, displayName: goals.displayName }).from(goals).where(eq(goals.websiteId, websiteId)),
    ]);

  const breakdowns: Breakdowns = { ...bg.breakdowns, entry: entryExit.entry, exit: entryExit.exit };
  mergeConv(breakdowns, convBd);

  if (granularity === "daily") {
    await enrichSpikes(websiteId, range, granularity, filters, series);
  }

  return {
    kpis: kpiPair.cur,
    deltas: computeDeltas(kpiPair.cur, kpiPair.prev),
    online,
    series,
    compareSeries,
    breakdowns,
    goals: mergeGoals(goalDefs, bg.goalsRaw, kpiPair.cur.visitors),
    funnel,
    users,
    journeys,
  };
}

// ───────────────────────── Overview (toate site-urile) ─────────────────────────
export async function getOverview(
  range: Range,
  granularity: Granularity,
): Promise<{ totalVisitors: number; sites: OverviewSite[] }> {
  const all = await db.select().from(websites).orderBy(websites.createdAt);
  if (!all.length) return { totalVisitors: 0, sites: [] };

  const from = range.from.toISOString();
  const to = range.to.toISOString();
  const starts = bucketStarts(range, granularity);
  const startISO = starts.map((d) => d.toISOString());

  const [visRows, sparkRows] = await Promise.all([
    // vizitatori distincți / site (tot intervalul)
    q<{ website_id: number; visitors: number }>(
      `SELECT website_id, count(DISTINCT visitor_id)::int AS visitors FROM events_human
       WHERE created_at>=$1::timestamptz AND created_at<$2::timestamptz AND visitor_id IS NOT NULL GROUP BY website_id`,
      [from, to],
    ),
    // sparkline: vizitatori / site / bucket — pe granițele EXACTE bucketStarts (tz-agnostic)
    q<{ website_id: number; idx: number; value: number }>(
      `WITH bnd AS (
         SELECT ord-1 AS idx, lo::timestamptz AS lo,
                coalesce(lead(lo) OVER (ORDER BY ord), $2::timestamptz) AS hi
         FROM unnest($3::timestamptz[]) WITH ORDINALITY AS u(lo, ord)
       )
       SELECT e.website_id, b.idx, count(DISTINCT e.visitor_id)::int AS value
       FROM bnd b JOIN events_human e ON e.created_at >= b.lo AND e.created_at < b.hi
       WHERE e.created_at>=$1::timestamptz AND e.created_at<$2::timestamptz AND e.visitor_id IS NOT NULL
       GROUP BY e.website_id, b.idx`,
      [from, to, startISO],
    ),
  ]);

  const visBySite = new Map(visRows.map((r) => [Number(r.website_id), Number(r.visitors)]));
  const sparkBySite = new Map<number, Map<number, number>>();
  for (const r of sparkRows) {
    const id = Number(r.website_id);
    let m = sparkBySite.get(id);
    if (!m) sparkBySite.set(id, (m = new Map()));
    m.set(Number(r.idx), Number(r.value));
  }

  const sites: OverviewSite[] = all.map((s) => {
    const m = sparkBySite.get(s.id) ?? new Map<number, number>();
    return {
      publicId: s.publicId,
      domain: s.domain,
      faviconUrl: s.faviconUrl,
      visitors: visBySite.get(s.id) ?? 0,
      spark: starts.map((_, i) => m.get(i) ?? 0),
    };
  });

  return {
    totalVisitors: sites.reduce((sum, s) => sum + s.visitors, 0),
    sites,
  };
}

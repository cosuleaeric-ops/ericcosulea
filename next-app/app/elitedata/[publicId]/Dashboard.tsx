"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ControlBar } from "./ControlBar";
import { KpiRow } from "./KpiRow";
import { MainChart } from "./MainChart";
import { Panels } from "./Panels";
import { BottomPanel } from "./BottomPanel";
import { CrawlerSection } from "./CrawlerSection";
import {
  computeRange,
  defaultGranularity,
  formatRangeLabel,
  isNavigable,
  isLive,
  PERIOD_LABELS,
  type Granularity,
  type PeriodKey,
} from "@/lib/analytics/range";
import type { StatsPayload, Kpis, Deltas, Filters } from "@/lib/analytics/queries";
import type { Deploy } from "@/lib/analytics/vercel";
import { countryName } from "@/lib/analytics/labels";
import { DASH_PERIOD_COOKIE, type InitialTabs } from "../period-persistence";

const FILTER_LABEL: Record<string, string> = {
  path: "Page",
  hostname: "Hostname",
  country: "Country",
  region: "Region",
  city: "City",
  source: "Referrer",
  device: "Device",
  os: "OS",
  browser: "Browser",
  channel: "Channel",
  campaign: "Campaign",
};

function chipValue(key: string, value: string): string {
  if (key === "country") return countryName(value);
  if (key === "device") return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}

// Drill-down: click pe un punct din grafic → restrânge tot dashboard-ul la acel
// bucket. Granularitatea devine mai fină ca să rămână util (zi→ore, oră→minute).
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
function drillGranularity(fromMs: number, toMs: number): Granularity {
  const span = toMs - fromMs;
  if (span <= 3 * HOUR_MS) return "minute";
  if (span <= 3 * DAY_MS) return "hourly";
  if (span <= 95 * DAY_MS) return "daily";
  return "monthly";
}
function drillLabel(from: Date, to: Date, tz: string): string {
  const date = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", timeZone: tz });
  const time = new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  const spanH = (to.getTime() - from.getTime()) / HOUR_MS;
  if (spanH <= 26) return `${date.format(from)}, ${time.format(from)}–${time.format(to)}`;
  return `${date.format(from)} – ${date.format(new Date(to.getTime() - 1))}`;
}

type SiteLite = { publicId: string; domain: string; faviconUrl: string | null };
type WebsiteProp = SiteLite & {
  name: string;
  timezone: string;
  kpiGoalName: string | null;
};
type Custom = { from: string; to: string };

// Perioada aleasă persistă într-un cookie (citit și pe server, ca să randăm din
// prima vederea corectă, fără flash last7 → 24h). Doar preset-uri, nu "custom".
function persistPeriod(p: PeriodKey) {
  try {
    document.cookie = `${DASH_PERIOD_COOKIE}=${p};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

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
const EMPTY_DELTAS: Deltas = {
  visitors: 0,
  conversionRate: 0,
  bounceRate: 0,
  sessionTime: 0,
  kpi1: 0,
};

export default function Dashboard({
  website,
  sites,
  initialData,
  initialPeriod,
  initialTabs,
}: {
  website: WebsiteProp;
  sites: SiteLite[];
  initialData: StatsPayload;
  initialPeriod: PeriodKey;
  initialTabs: InitialTabs;
}) {
  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState<Custom | null>(null);
  const [granularity, setGranularity] = useState<Granularity>(
    defaultGranularity(initialPeriod),
  );
  const [compare, setCompare] = useState(false);
  const [showGoalBars, setShowGoalBars] = useState(true);
  const [filters, setFilters] = useState<Partial<Record<keyof Filters, string>>>({});
  const [drill, setDrill] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<StatsPayload | null>(initialData);
  const [deploysByDay, setDeploysByDay] = useState<Record<string, Deploy[]>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);
  const first = useRef(true);

  // Preferința „arată barele de conversii" persistă în localStorage (per browser).
  useEffect(() => {
    try {
      if (localStorage.getItem("elitedata:showGoalBars") === "0")
        setShowGoalBars(false);
    } catch {
      /* ignore */
    }
  }, []);
  const toggleGoalBars = () =>
    setShowGoalBars((v) => {
      const next = !v;
      try {
        localStorage.setItem("elitedata:showGoalBars", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  const tz = website.timezone;
  const range = drill
    ? { from: new Date(drill.from), to: new Date(drill.to) }
    : computeRange(period, offset, custom ?? undefined);
  const gran: Granularity = drill
    ? drillGranularity(new Date(drill.from).getTime(), new Date(drill.to).getTime())
    : granularity;
  const displayLabel = drill
    ? drillLabel(range.from, range.to, tz)
    : period === "custom" || (isNavigable(period) && offset !== 0)
      ? formatRangeLabel(range, tz)
      : PERIOD_LABELS[period];

  const load = useCallback(
    async (mode: "full" | "refresh" | "silent") => {
      const r = drill
        ? { from: new Date(drill.from), to: new Date(drill.to) }
        : computeRange(period, offset, custom ?? undefined);
      const g = drill
        ? drillGranularity(new Date(drill.from).getTime(), new Date(drill.to).getTime())
        : granularity;
      const params = new URLSearchParams({
        site: website.publicId,
        from: r.from.toISOString(),
        to: r.to.toISOString(),
        granularity: g,
        compare: compare ? "1" : "0",
      });
      for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);

      const id = ++reqId.current;
      if (mode === "full") setLoading(true);
      else if (mode === "refresh") setRefreshing(true);
      try {
        const res = await fetch(`/api/analytics/stats?${params}`, { cache: "no-store" });
        if (id !== reqId.current) return;
        if (res.ok) setData(await res.json());
      } catch {
        /* ignore */
      } finally {
        if (id === reqId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [period, offset, custom, granularity, compare, filters, website.publicId, drill],
  );

  useEffect(() => {
    // Prima randare folosește initialData de la server (last7/daily); evităm
    // un fetch redundant. Refetch doar când userul schimbă ceva.
    if (first.current) {
      first.current = false;
      return;
    }
    load("full");
  }, [load]);

  // Mod live: la "Now" reîmprospătează silențios la fiecare 10s.
  useEffect(() => {
    if (!isLive(period)) return;
    const id = setInterval(() => load("silent"), 10_000);
    return () => clearInterval(id);
  }, [period, load]);

  // Deploy-uri Vercel pe grafic — doar pe granularitate zilnică (marcaje/zi).
  useEffect(() => {
    // Când drill-ul e activ granularitatea e sub-zi → fără marcaje de deploy.
    if (drill || granularity !== "daily") return;
    let cancelled = false;
    const r = computeRange(period, offset, custom ?? undefined);
    const params = new URLSearchParams({
      site: website.publicId,
      from: r.from.toISOString(),
      to: r.to.toISOString(),
    });
    fetch(`/api/analytics/vercel/deploys?${params}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { connected: false }))
      .then((j) => !cancelled && setDeploysByDay(j.connected ? j.byDay : {}))
      .catch(() => !cancelled && setDeploysByDay({}));
    return () => {
      cancelled = true;
    };
  }, [website.publicId, period, offset, custom, granularity, drill]);

  // Scurtături de tastatură (ca în DataFast).
  useEffect(() => {
    const map: Record<string, PeriodKey> = {
      n: "now",
      t: "today",
      y: "yesterday",
      d: "last24h",
      w: "last7",
      "3": "last30",
    };
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const p = map[e.key.toLowerCase()];
      if (p) {
        e.preventDefault();
        changePeriod(p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changePeriod(p: PeriodKey) {
    setDrill(null);
    setPeriod(p);
    setOffset(0);
    setCustom(null);
    setGranularity(defaultGranularity(p));
    persistPeriod(p);
  }

  function applyCustom(from: string, to: string) {
    const span = new Date(to + "T23:59:59").getTime() - new Date(from + "T00:00:00").getTime();
    setDrill(null);
    setPeriod("custom");
    setOffset(0);
    setCustom({ from, to });
    setGranularity(defaultGranularity("custom", span));
  }

  // Click pe un punct din grafic → drill-down la acel bucket.
  const drillTo = (fromISO: string, toISO: string | null) =>
    setDrill({ from: fromISO, to: toISO ?? range.to.toISOString() });

  const addFilter = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const removeFilter = (key: keyof Filters) =>
    setFilters((f) => {
      const n = { ...f };
      delete n[key];
      return n;
    });
  const clearFilters = () => setFilters({});
  const activeFilters = Object.entries(filters).filter(([, v]) => v) as [
    keyof Filters,
    string,
  ][];

  const kpis = data?.kpis ?? EMPTY_KPIS;
  const deltas = data?.deltas ?? EMPTY_DELTAS;
  const noData = loading && !data;

  return (
    <div className="dfa-dashboard">
      <ControlBar
        site={website}
        sites={sites}
        period={period}
        offset={offset}
        displayLabel={displayLabel}
        tz={tz}
        custom={custom}
        granularity={granularity}
        compare={compare}
        refreshing={refreshing}
        filterCount={Object.values(filters).filter(Boolean).length}
        hasGoal={!!kpis.kpi1Name}
        showGoalBars={showGoalBars}
        onToggleGoalBars={toggleGoalBars}
        onPeriod={changePeriod}
        onCustom={applyCustom}
        onShift={(dir) => {
          setDrill(null);
          setOffset((o) => Math.min(0, o + dir));
        }}
        onGranularity={setGranularity}
        onToggleCompare={() => setCompare((c) => !c)}
        onRefresh={() => load("refresh")}
        onFilter={() => activeFilters.length && clearFilters()}
      />

      {drill && (
        <div className="dfa-filter-chips">
          <button
            className="dfa-chip"
            onClick={() => setDrill(null)}
            title="Ieși din interval — înapoi la perioada întreagă"
          >
            <span className="dfa-chip-key">Interval</span>
            {displayLabel}
            <X size={12} />
          </button>
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="dfa-filter-chips">
          {activeFilters.map(([key, value]) => (
            <button
              key={key}
              className="dfa-chip"
              onClick={() => removeFilter(key)}
              title="Elimină filtrul"
            >
              <span className="dfa-chip-key">{FILTER_LABEL[key] ?? key}</span>
              {chipValue(key, value)}
              <X size={12} />
            </button>
          ))}
          {activeFilters.length > 1 && (
            <button className="dfa-chip dfa-chip-clear" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      <div className="dfa-card dfa-kpi-chart-panel">
        <KpiRow kpis={kpis} deltas={deltas} online={data?.online ?? 0} loading={noData} />
        <MainChart
          series={data?.series ?? []}
          compareSeries={data?.compareSeries ?? null}
          deploysByDay={gran === "daily" ? deploysByDay : {}}
          tz={tz}
          loading={noData || refreshing}
          goalName={kpis.kpi1Name}
          showGoal={showGoalBars}
          onDrill={drillTo}
        />
      </div>
      <Panels
        breakdowns={data?.breakdowns ?? null}
        loading={noData}
        onFilter={addFilter}
        sitePublicId={website.publicId}
        from={range.from.toISOString()}
        to={range.to.toISOString()}
        pathFilter={filters.path}
        initialTabs={initialTabs}
      />
      <BottomPanel
        sitePublicId={website.publicId}
        goals={data?.goals ?? []}
        funnel={data?.funnel ?? null}
        users={data?.users ?? []}
        journeys={data?.journeys ?? []}
        loading={noData}
        onGoalAdded={() => load("refresh")}
        initialTab={initialTabs.bottom}
      />
      <CrawlerSection
        site={website.publicId}
        from={range.from.toISOString()}
        to={range.to.toISOString()}
      />
    </div>
  );
}

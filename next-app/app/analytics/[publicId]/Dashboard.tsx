"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { ControlBar } from "./ControlBar";
import { KpiRow } from "./KpiRow";
import { MainChart } from "./MainChart";
import { Panels } from "./Panels";
import { BottomPanel } from "./BottomPanel";
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
import { countryName } from "@/lib/analytics/labels";

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

type SiteLite = { publicId: string; domain: string; faviconUrl: string | null };
type WebsiteProp = SiteLite & {
  name: string;
  timezone: string;
  kpiGoalName: string | null;
};
type Custom = { from: string; to: string };

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
}: {
  website: WebsiteProp;
  sites: SiteLite[];
}) {
  const [period, setPeriod] = useState<PeriodKey>("last7");
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState<Custom | null>(null);
  const [granularity, setGranularity] = useState<Granularity>(
    defaultGranularity("last7"),
  );
  const [compare, setCompare] = useState(false);
  const [filters, setFilters] = useState<Partial<Record<keyof Filters, string>>>({});
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);

  const range = computeRange(period, offset, custom ?? undefined);
  const tz = website.timezone;
  const displayLabel =
    period === "custom" || (isNavigable(period) && offset !== 0)
      ? formatRangeLabel(range, tz)
      : PERIOD_LABELS[period];

  const load = useCallback(
    async (mode: "full" | "refresh" | "silent") => {
      const r = computeRange(period, offset, custom ?? undefined);
      const params = new URLSearchParams({
        site: website.publicId,
        from: r.from.toISOString(),
        to: r.to.toISOString(),
        granularity,
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
    [period, offset, custom, granularity, compare, filters, website.publicId],
  );

  useEffect(() => {
    load("full");
  }, [load]);

  // Mod live: la "Now" reîmprospătează silențios la fiecare 10s.
  useEffect(() => {
    if (!isLive(period)) return;
    const id = setInterval(() => load("silent"), 10_000);
    return () => clearInterval(id);
  }, [period, load]);

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
    setPeriod(p);
    setOffset(0);
    setCustom(null);
    setGranularity(defaultGranularity(p));
  }

  function applyCustom(from: string, to: string) {
    const span = new Date(to + "T23:59:59").getTime() - new Date(from + "T00:00:00").getTime();
    setPeriod("custom");
    setOffset(0);
    setCustom({ from, to });
    setGranularity(defaultGranularity("custom", span));
  }

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
        onPeriod={changePeriod}
        onCustom={applyCustom}
        onShift={(dir) => setOffset((o) => Math.min(0, o + dir))}
        onGranularity={setGranularity}
        onToggleCompare={() => setCompare((c) => !c)}
        onRefresh={() => load("refresh")}
        onFilter={() => activeFilters.length && clearFilters()}
      />

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

      <KpiRow kpis={kpis} deltas={deltas} online={data?.online ?? 0} loading={noData} />
      <MainChart
        series={data?.series ?? []}
        compareSeries={data?.compareSeries ?? null}
        loading={noData || refreshing}
      />
      <Panels
        breakdowns={data?.breakdowns ?? null}
        loading={noData}
        onFilter={addFilter}
        sitePublicId={website.publicId}
        from={range.from.toISOString()}
        to={range.to.toISOString()}
        pathFilter={filters.path}
      />
      <BottomPanel
        sitePublicId={website.publicId}
        goals={data?.goals ?? []}
        funnel={data?.funnel ?? null}
        users={data?.users ?? []}
        journeys={data?.journeys ?? []}
        loading={noData}
        onGoalAdded={() => load("refresh")}
      />
    </div>
  );
}

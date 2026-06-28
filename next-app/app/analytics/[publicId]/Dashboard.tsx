"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ControlBar } from "./ControlBar";
import { KpiRow } from "./KpiRow";
import { MainChart } from "./MainChart";
import {
  computeRange,
  defaultGranularity,
  formatRangeLabel,
  type Granularity,
  type PeriodKey,
} from "@/lib/analytics/range";
import type { StatsPayload, Kpis, Deltas } from "@/lib/analytics/queries";

type SiteLite = { publicId: string; domain: string; faviconUrl: string | null };
type WebsiteProp = SiteLite & {
  name: string;
  timezone: string;
  kpiGoalName: string | null;
};

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
  const [granularity, setGranularity] = useState<Granularity>(
    defaultGranularity("last7"),
  );
  const [compare, setCompare] = useState(false);
  const [filters] = useState<Record<string, string>>({});
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);

  const range = computeRange(period, offset);
  const rangeLabel = formatRangeLabel(range, website.timezone);

  const load = useCallback(
    async (mode: "full" | "refresh") => {
      const r = computeRange(period, offset);
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
      else setRefreshing(true);
      try {
        const res = await fetch(`/api/analytics/stats?${params}`, {
          cache: "no-store",
        });
        if (id !== reqId.current) return; // răspuns stale
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
    [period, offset, granularity, compare, filters, website.publicId],
  );

  useEffect(() => {
    load("full");
  }, [load]);

  function changePeriod(p: PeriodKey) {
    setPeriod(p);
    setOffset(0);
    setGranularity(defaultGranularity(p));
  }

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
        rangeLabel={rangeLabel}
        granularity={granularity}
        compare={compare}
        refreshing={refreshing}
        filterCount={Object.values(filters).filter(Boolean).length}
        onPeriod={changePeriod}
        onShift={(dir) => setOffset((o) => Math.min(0, o + dir))}
        onGranularity={setGranularity}
        onToggleCompare={() => setCompare((c) => !c)}
        onRefresh={() => load("refresh")}
        onFilter={() => {
          /* popover de filtre — M4 */
        }}
      />
      <KpiRow
        kpis={kpis}
        deltas={deltas}
        online={data?.online ?? 0}
        loading={noData}
      />
      <MainChart
        series={data?.series ?? []}
        compareSeries={data?.compareSeries ?? null}
        loading={noData || refreshing}
      />
    </div>
  );
}

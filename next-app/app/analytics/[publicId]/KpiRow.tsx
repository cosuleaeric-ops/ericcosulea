"use client";
import type { Kpis, Deltas } from "@/lib/analytics/queries";
import {
  formatNumber,
  formatDuration,
  formatPct,
  deltaDisplay,
  type DeltaDisplay,
} from "@/lib/analytics/format";
import { useCountUp } from "../_components/useCountUp";

function DeltaChip({ d }: { d: DeltaDisplay }) {
  return <span className={`dfa-delta dfa-delta-${d.dir}`}>{d.text}</span>;
}

function KpiCard({
  label,
  raw,
  format,
  delta,
  loading,
  empty,
  online,
}: {
  label: string;
  raw: number;
  format: (n: number) => string;
  delta?: DeltaDisplay | null;
  loading: boolean;
  empty?: boolean;
  online?: boolean;
}) {
  const v = useCountUp(raw);
  return (
    <div className="dfa-kpi">
      <div className="dfa-kpi-label">
        {online && <span className="dfa-online-dot" />}
        {label}
      </div>
      {loading ? (
        <div className="dfa-skeleton dfa-kpi-skel" />
      ) : (
        <>
          <div className="dfa-kpi-value">{empty ? "—" : format(v)}</div>
          {delta && <DeltaChip d={delta} />}
        </>
      )}
    </div>
  );
}

export function KpiRow({
  kpis,
  deltas,
  online,
  loading,
}: {
  kpis: Kpis;
  deltas: Deltas;
  online: number;
  loading: boolean;
}) {
  return (
    <div className="dfa-kpi-row">
      <KpiCard
        label="Visitors"
        raw={kpis.visitors}
        format={formatNumber}
        delta={deltaDisplay(deltas.visitors, true)}
        loading={loading}
      />
      <KpiCard
        label="Your #1 KPI"
        raw={kpis.kpi1Value ?? 0}
        format={formatNumber}
        delta={kpis.kpi1Value === null ? null : deltaDisplay(deltas.kpi1, true)}
        empty={kpis.kpi1Value === null}
        loading={loading}
      />
      <KpiCard
        label="Conversion rate"
        raw={kpis.conversionRate}
        format={(n) => formatPct(n, 1)}
        delta={deltaDisplay(deltas.conversionRate, true)}
        loading={loading}
      />
      <KpiCard
        label="Bounce rate"
        raw={kpis.bounceRate}
        format={(n) => formatPct(n, 0)}
        delta={deltaDisplay(deltas.bounceRate, false)}
        loading={loading}
      />
      <KpiCard
        label="Session time"
        raw={kpis.sessionTime}
        format={formatDuration}
        delta={deltaDisplay(deltas.sessionTime, true)}
        loading={loading}
      />
      <KpiCard
        label="Online"
        raw={online}
        format={formatNumber}
        loading={loading}
        online
      />
    </div>
  );
}

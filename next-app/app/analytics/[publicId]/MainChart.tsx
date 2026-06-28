"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/analytics/queries";
import { formatNumber } from "@/lib/analytics/format";

type Row = { label: string; value: number; compareValue?: number };

function buildData(
  series: SeriesPoint[],
  compare: SeriesPoint[] | null,
): Row[] {
  return series.map((p, i) => ({
    label: p.label,
    value: p.value,
    compareValue: compare ? compare[i]?.value ?? 0 : undefined,
  }));
}

function ChartTooltip({
  active,
  payload,
  label,
  hasCompare,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Row }>;
  label?: string;
  hasCompare: boolean;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="dfa-chart-tip">
      <div className="dfa-chart-tip-label">{label}</div>
      <div className="dfa-chart-tip-row">
        <span className="dfa-dot" style={{ background: "var(--dfa-chart)" }} />
        <strong>{formatNumber(row.value)}</strong> visitors
      </div>
      {hasCompare && row.compareValue !== undefined && (
        <div className="dfa-chart-tip-row dfa-muted">
          <span className="dfa-dot" style={{ background: "var(--dfa-chart-compare)" }} />
          {formatNumber(row.compareValue)} previous
        </div>
      )}
    </div>
  );
}

export function MainChart({
  series,
  compareSeries,
  loading,
}: {
  series: SeriesPoint[];
  compareSeries: SeriesPoint[] | null;
  loading: boolean;
}) {
  const data = buildData(series, compareSeries);
  const hasCompare = !!compareSeries;

  return (
    <div className="dfa-main-chart">
      {loading && <div className="dfa-chart-shimmer" />}
      <div className="dfa-chart-inner" style={{ opacity: loading ? 0.4 : 1 }}>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -16 }}>
            <defs>
              <linearGradient id="dfa-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dfa-chart)" stopOpacity={0.38} />
                <stop offset="100%" stopColor="var(--dfa-chart)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={{ fill: "var(--dfa-faint)", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
              tick={{ fill: "var(--dfa-faint)", fontSize: 11 }}
            />
            <Tooltip
              content={<ChartTooltip hasCompare={hasCompare} />}
              cursor={{ stroke: "rgba(255,255,255,0.22)", strokeWidth: 1 }}
            />
            {hasCompare && (
              <Area
                type="monotone"
                dataKey="compareValue"
                stroke="var(--dfa-chart-compare)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="transparent"
                dot={false}
                isAnimationActive={!loading}
                animationDuration={700}
                animationEasing="ease-out"
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--dfa-chart)"
              strokeWidth={2.4}
              fill="url(#dfa-grad)"
              dot={false}
              activeDot={{
                r: 4,
                fill: "var(--dfa-chart)",
                stroke: "var(--dfa-bg)",
                strokeWidth: 2,
              }}
              isAnimationActive={!loading}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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
import type { Deploy } from "@/lib/analytics/vercel";
import { formatNumber, dayKeyInTz } from "@/lib/analytics/format";

type Row = {
  label: string;
  value: number;
  compareValue?: number;
  newValue?: number;
  returningValue?: number;
  deploys?: Deploy[];
};

function buildData(
  series: SeriesPoint[],
  compare: SeriesPoint[] | null,
  deploysByDay: Record<string, Deploy[]>,
  tz: string,
): Row[] {
  return series.map((p, i) => ({
    label: p.label,
    value: p.value,
    newValue: p.newValue,
    returningValue: p.returningValue,
    compareValue: compare ? compare[i]?.value ?? 0 : undefined,
    deploys: deploysByDay[dayKeyInTz(p.t, tz)],
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
  const hasSplit =
    row.value > 0 &&
    row.newValue !== undefined &&
    row.returningValue !== undefined;
  return (
    <div className="dfa-chart-tip">
      <div className="dfa-chart-tip-label">{label}</div>
      <div className="dfa-chart-tip-row">
        <span className="dfa-dot" style={{ background: "var(--dfa-chart)" }} />
        <strong>{formatNumber(row.value)}</strong> visitors
      </div>
      {hasSplit && (
        <>
          <div className="dfa-tip-bar">
            <span
              className="dfa-tip-bar-new"
              style={{ flexBasis: `${(row.newValue! / row.value) * 100}%` }}
            />
            <span
              className="dfa-tip-bar-ret"
              style={{ flexBasis: `${(row.returningValue! / row.value) * 100}%` }}
            />
          </div>
          <div className="dfa-tip-split">
            <span>{formatNumber(row.newValue!)} new</span>
            <span>{formatNumber(row.returningValue!)} returning</span>
          </div>
        </>
      )}
      {hasCompare && row.compareValue !== undefined && (
        <div className="dfa-chart-tip-row dfa-muted">
          <span className="dfa-dot" style={{ background: "var(--dfa-chart-compare)" }} />
          {formatNumber(row.compareValue)} previous
        </div>
      )}
      {row.deploys && row.deploys.length > 0 && (
        <div className="dfa-tip-deploys">
          {row.deploys.slice(0, 4).map((d) => (
            <div className="dfa-tip-deploy" key={d.id}>
              <span className="dfa-tip-deploy-mark" />
              <span className="dfa-tip-deploy-msg">{d.message}</span>
            </div>
          ))}
          {row.deploys.length > 4 && (
            <div className="dfa-tip-deploy-more">+{row.deploys.length - 4} more</div>
          )}
        </div>
      )}
    </div>
  );
}

export function MainChart({
  series,
  compareSeries,
  deploysByDay,
  tz,
  loading,
}: {
  series: SeriesPoint[];
  compareSeries: SeriesPoint[] | null;
  deploysByDay: Record<string, Deploy[]>;
  tz: string;
  loading: boolean;
}) {
  const data = buildData(series, compareSeries, deploysByDay, tz);
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
              animationDuration={1500}
              animationEasing="ease"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

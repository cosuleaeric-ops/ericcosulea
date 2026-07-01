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
import { sourceFavicon } from "@/lib/analytics/labels";

type Row = {
  label: string;
  value: number;
  compareValue?: number;
  newValue?: number;
  returningValue?: number;
  deploys?: Deploy[];
  spikeSource?: string | null;
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
    spikeSource: p.spikeSource,
  }));
}

// Marcaje persistente pe grafic: favicon-ul sursei în zilele cu spike + badge de
// deploy, sus în coloana zilei, legate de linie printr-un fir subtil (ca DataFast).
function ChartMarker(props: {
  cx?: number;
  cy?: number;
  payload?: Row;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const hasDeploy = !!payload.deploys?.length;
  const spike = payload.spikeSource;
  const fav = spike ? sourceFavicon(spike) : null;
  if (!hasDeploy && !spike) return null;

  // Ținem badge-urile în interiorul zonei de plot (top ≥ margin.top=12) ca să nu
  // fie tăiate de clip-ul recharts, dar sus în coloană (ca DataFast).
  const spikeY = 24;
  const deployY = spike ? 48 : 24;
  const anchorY = (hasDeploy ? deployY : spikeY) + 11;

  return (
    <g>
      <line
        x1={cx}
        y1={anchorY}
        x2={cx}
        y2={cy}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth={1}
      />
      {spike && (
        <>
          <rect
            x={cx - 11}
            y={spikeY - 11}
            width={22}
            height={22}
            rx={7}
            fill="var(--dfa-panel-2)"
            stroke="var(--dfa-border-strong)"
          />
          {fav ? (
            <image href={fav} x={cx - 7} y={spikeY - 7} width={14} height={14} />
          ) : (
            <circle cx={cx} cy={spikeY} r={3.5} fill="var(--dfa-chart)" />
          )}
        </>
      )}
      {hasDeploy && (
        <>
          <circle
            cx={cx}
            cy={deployY}
            r={11}
            fill="var(--dfa-panel-2)"
            stroke="var(--dfa-border-strong)"
          />
          <circle
            cx={cx}
            cy={deployY}
            r={2.6}
            fill="none"
            stroke="var(--dfa-accent)"
            strokeWidth={1.7}
          />
          <path
            d={`M${cx - 6} ${deployY} h3 M${cx + 3} ${deployY} h3`}
            stroke="var(--dfa-accent)"
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
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
      {row.spikeSource && (
        <div className="dfa-tip-spike">
          {sourceFavicon(row.spikeSource) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sourceFavicon(row.spikeSource)!} alt="" width={14} height={14} />
          ) : (
            <span className="dfa-dot" style={{ background: "var(--dfa-chart)" }} />
          )}
          Traffic spike from <strong>{row.spikeSource}</strong>
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
              dot={<ChartMarker />}
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

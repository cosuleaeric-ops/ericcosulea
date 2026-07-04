"use client";
import { useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/analytics/queries";
import type { Deploy } from "@/lib/analytics/vercel";
import { formatNumber, dayKeyInTz } from "@/lib/analytics/format";
import { sourceFavicon } from "@/lib/analytics/labels";
import { DeployPanel } from "./DeployPanel";

type Row = {
  label: string;
  value: number;
  compareValue?: number;
  newValue?: number;
  returningValue?: number;
  goalValue?: number; // conversii KPI #1 în bucket (bara portocalie)
  spikeSource?: string | null;
  dayKey: string; // pentru lookup deploys (ținut în afara datelor animate)
};

// Datele graficului NU conțin deploy-urile (acelea vin async și ar reporni
// animația). Deploy-urile se caută separat, după dayKey.
function buildData(
  series: SeriesPoint[],
  compare: SeriesPoint[] | null,
  tz: string,
): Row[] {
  return series.map((p, i) => ({
    label: p.label,
    value: p.value,
    newValue: p.newValue,
    returningValue: p.returningValue,
    goalValue: p.goalValue,
    compareValue: compare ? compare[i]?.value ?? 0 : undefined,
    spikeSource: p.spikeSource,
    dayKey: dayKeyInTz(p.t, tz),
  }));
}

// Marcaje PE grafic: favicon-ul sursei (spike) + badge de deploy, așezate chiar
// deasupra punctului zilei — se mișcă odată cu linia, nu plutesc sus (ca DataFast).
function ChartMarker(props: {
  cx?: number;
  cy?: number;
  payload?: Row;
  deploysByDay?: Record<string, Deploy[]>;
  onOpen?: (deploys: Deploy[]) => void;
}) {
  const { cx, cy, payload, deploysByDay, onOpen } = props;
  if (cx == null || cy == null || !payload) return null;
  const deploys = payload.dayKey ? deploysByDay?.[payload.dayKey] : undefined;
  const hasDeploy = !!deploys?.length;
  const spike = payload.spikeSource;
  const fav = spike ? sourceFavicon(spike) : null;
  if (!hasDeploy && !spike) return null;

  // Ancorat la valoarea zilei (cy), chiar deasupra punctului. Clamp la top ca să
  // nu iasă din plot când valoarea e mare.
  const clampY = (y: number) => Math.max(14, y);
  const deployCY = clampY(cy - 15);
  const spikeCY = clampY(hasDeploy ? cy - 37 : cy - 15);

  return (
    <g>
      {spike && (
        <>
          <rect
            x={cx - 11}
            y={spikeCY - 11}
            width={22}
            height={22}
            rx={7}
            fill="var(--dfa-panel-2)"
            stroke="var(--dfa-border-strong)"
          />
          {fav ? (
            <image href={fav} x={cx - 7} y={spikeCY - 7} width={14} height={14} />
          ) : (
            <circle cx={cx} cy={spikeCY} r={3.5} fill="var(--dfa-chart)" />
          )}
        </>
      )}
      {hasDeploy && (
        <g
          style={{ cursor: "pointer", pointerEvents: "all" }}
          onClick={(e) => {
            e.stopPropagation();
            if (deploys?.length) onOpen?.(deploys);
          }}
        >
          <circle cx={cx} cy={deployCY} r={14} fill="transparent" />
          <circle
            cx={cx}
            cy={deployCY}
            r={11}
            fill="var(--dfa-panel-2)"
            stroke="var(--dfa-border-strong)"
          />
          <circle
            cx={cx}
            cy={deployCY}
            r={2.6}
            fill="none"
            stroke="var(--dfa-accent)"
            strokeWidth={1.7}
          />
          <path
            d={`M${cx - 6} ${deployCY} h3 M${cx + 3} ${deployCY} h3`}
            stroke="var(--dfa-accent)"
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  hasCompare,
  goalName,
  deploysByDay,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: Row }>;
  label?: string;
  hasCompare: boolean;
  goalName?: string | null;
  deploysByDay?: Record<string, Deploy[]>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const deploys = row.dayKey ? deploysByDay?.[row.dayKey] : undefined;
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
      {goalName && (row.goalValue ?? 0) > 0 && (
        <div className="dfa-chart-tip-row">
          <span className="dfa-dot" style={{ background: "var(--dfa-goal, #f59e0b)" }} />
          <strong>{formatNumber(row.goalValue!)}</strong> {goalName}
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
      {deploys && deploys.length > 0 && (
        <div className="dfa-tip-deploys">
          {deploys.slice(0, 4).map((d) => (
            <div className="dfa-tip-deploy" key={d.id}>
              <span className="dfa-tip-deploy-mark" />
              <span className="dfa-tip-deploy-msg">{d.message}</span>
            </div>
          ))}
          {deploys.length > 4 && (
            <div className="dfa-tip-deploy-more">+{deploys.length - 4} more</div>
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
  goalName,
}: {
  series: SeriesPoint[];
  compareSeries: SeriesPoint[] | null;
  deploysByDay: Record<string, Deploy[]>;
  tz: string;
  loading: boolean;
  goalName?: string | null;
}) {
  // Memoizat pe serie/compare/tz — NU pe deploysByDay. Așa sosirea async a
  // deploy-urilor nu schimbă referința `data` și recharts nu repornește animația.
  const data = useMemo(
    () => buildData(series, compareSeries, tz),
    [series, compareSeries, tz],
  );
  const hasCompare = !!compareSeries;
  // Bara portocalie de conversii apare doar dacă există un KPI cu conversii > 0.
  const hasGoal = !!goalName && data.some((d) => (d.goalValue ?? 0) > 0);
  const [openDeploys, setOpenDeploys] = useState<Deploy[] | null>(null);

  return (
    <div className="dfa-main-chart">
      {loading && <div className="dfa-chart-shimmer" />}
      <div className="dfa-chart-inner" style={{ opacity: loading ? 0.4 : 1 }}>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -16 }}>
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
              yAxisId="visitors"
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
              tick={{ fill: "var(--dfa-faint)", fontSize: 11 }}
            />
            {/* Axă secundară ascunsă pentru conversii — bara își are scala ei. */}
            <YAxis yAxisId="goal" orientation="right" hide allowDecimals={false} />
            <Tooltip
              content={<ChartTooltip hasCompare={hasCompare} goalName={goalName} deploysByDay={deploysByDay} />}
              cursor={{ stroke: "rgba(255,255,255,0.22)", strokeWidth: 1 }}
            />
            {hasGoal && (
              <Bar
                yAxisId="goal"
                dataKey="goalValue"
                fill="var(--dfa-goal, #f59e0b)"
                fillOpacity={0.85}
                radius={[3, 3, 0, 0]}
                maxBarSize={22}
                isAnimationActive={!loading}
                animationDuration={900}
                animationEasing="ease-out"
              />
            )}
            {hasCompare && (
              <Area
                yAxisId="visitors"
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
              yAxisId="visitors"
              type="monotone"
              dataKey="value"
              stroke="var(--dfa-chart)"
              strokeWidth={2.4}
              fill="url(#dfa-grad)"
              dot={<ChartMarker deploysByDay={deploysByDay} onOpen={setOpenDeploys} />}
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
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {openDeploys && (
        <DeployPanel deploys={openDeploys} tz={tz} onClose={() => setOpenDeploys(null)} />
      )}
    </div>
  );
}

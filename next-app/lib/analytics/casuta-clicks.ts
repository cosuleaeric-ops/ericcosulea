import "server-only";
import { previousRange, type Range } from "./range";
import type { SeriesPoint, StatsPayload } from "./queries";

function countBetween(timestamps: number[], from: Date, to: Date): number {
  const lo = from.getTime();
  const hi = to.getTime();
  return timestamps.filter((timestamp) => timestamp >= lo && timestamp < hi).length;
}

function fillSeries(series: SeriesPoint[] | null, timestamps: number[], range: Range): void {
  if (!series) return;
  series.forEach((point, index) => {
    const from = new Date(point.t);
    const next = series[index + 1];
    const to = next ? new Date(next.t) : range.to;
    point.goalValue = countBetween(timestamps, from, to);
  });
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export async function applyExternalClickKpi(
  stats: StatsPayload,
  range: Range,
  config: {
    endpoint: string;
    secretEnv: string;
    goalName: string;
    rollingDays?: number[];
  },
): Promise<void> {
  const secret = process.env[config.secretEnv];
  if (!secret) throw new Error(`${config.secretEnv} is not set`);

  const rollingDays = config.rollingDays?.find((days) => {
    const span = range.to.getTime() - range.from.getTime();
    const day = 24 * 60 * 60 * 1000;
    return span >= (days - 1) * day && span < days * day;
  });
  const sourceRange = rollingDays
    ? { from: new Date(range.to.getTime() - rollingDays * 24 * 60 * 60 * 1000), to: range.to }
    : range;
  const previous = rollingDays
    ? { from: new Date(sourceRange.from.getTime() - rollingDays * 24 * 60 * 60 * 1000), to: sourceRange.from }
    : previousRange(range);
  const url = new URL(config.endpoint);
  url.searchParams.set("from", previous.from.toISOString());
  url.searchParams.set("to", range.to.toISOString());

  const response = await fetch(url, {
    headers: { "x-elitedata-secret": secret },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Casuta Smart click API returned ${response.status}`);

  const body = (await response.json()) as { timestamps?: string[] };
  const timestamps = (body.timestamps ?? [])
    .map((timestamp) => new Date(timestamp).getTime())
    .filter(Number.isFinite);
  const currentCount = countBetween(timestamps, sourceRange.from, sourceRange.to);
  const previousCount = countBetween(timestamps, previous.from, previous.to);

  stats.kpis.kpi1Name = config.goalName;
  stats.kpis.kpi1Value = currentCount;
  stats.deltas.kpi1 = delta(currentCount, previousCount);
  fillSeries(stats.series, timestamps, range);
  fillSeries(stats.compareSeries, timestamps, previous);

  const goal = stats.goals.find((item) => item.name === config.goalName);
  if (goal) {
    goal.count = currentCount;
    goal.rate = stats.kpis.visitors ? (currentCount / stats.kpis.visitors) * 100 : 0;
  }
}

export function applyCasutaClickKpi(stats: StatsPayload, range: Range): Promise<void> {
  return applyExternalClickKpi(stats, range, {
    endpoint: "https://casutasmart.ro/api/elitedata/clicks",
    secretEnv: "CASUTASMART_ANALYTICS_SECRET",
    goalName: "click_afiliat",
  });
}

export function applyCesaicumparClickKpi(stats: StatsPayload, range: Range): Promise<void> {
  return applyExternalClickKpi(stats, range, {
    endpoint: "https://cesaicumpar.ro/api/elitedata/clicks",
    secretEnv: "CESAICUMPAR_ANALYTICS_SECRET",
    goalName: "affiliate_click",
    rollingDays: [7, 14, 30, 90, 365],
  });
}

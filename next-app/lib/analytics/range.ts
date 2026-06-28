// Range-uri de timp + bucketing. Pur, folosit pe client (dropdown) și server (serii).

export type Granularity = "minute" | "hourly" | "daily" | "monthly";

export type PeriodKey =
  | "now"
  | "today"
  | "yesterday"
  | "last24h"
  | "last7"
  | "last30"
  | "last12months"
  | "wtd"
  | "mtd"
  | "ytd"
  | "alltime"
  | "custom";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  now: "Now",
  today: "Today",
  yesterday: "Yesterday",
  last24h: "Last 24 hours",
  last7: "Last 7 days",
  last30: "Last 30 days",
  last12months: "Last 12 months",
  wtd: "Week to date",
  mtd: "Month to date",
  ytd: "Year to date",
  alltime: "All time",
  custom: "Custom",
};

// Scurtăturile din DataFast (cele care există în UI).
export const PERIOD_SHORTCUTS: Partial<Record<PeriodKey, string>> = {
  now: "N",
  today: "T",
  yesterday: "Y",
  last24h: "D",
  last7: "W",
  last30: "3",
};

// Ordinea din dropdown (custom e randat separat, cu calendar).
export const PERIOD_ORDER: PeriodKey[] = [
  "now",
  "today",
  "yesterday",
  "last24h",
  "last7",
  "last30",
  "last12months",
  "wtd",
  "mtd",
  "ytd",
  "alltime",
];

// Doar acestea suportă săgețile < > (deplasare).
const NAVIGABLE = new Set<PeriodKey>([
  "today",
  "yesterday",
  "last24h",
  "last7",
  "last30",
]);
export function isNavigable(p: PeriodKey): boolean {
  return NAVIGABLE.has(p);
}

export function isLive(p: PeriodKey): boolean {
  return p === "now";
}

const HOUR = 3600_000;
const DAY = 86_400_000;

export type Range = { from: Date; to: Date };
export type CustomRange = { from: string; to: string }; // ISO date (yyyy-mm-dd)

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // luni = 0
  return addDays(x, -dow);
}
function startOfMonth(d: Date, monthOffset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
}

export function computeRange(
  p: PeriodKey,
  offset = 0,
  custom?: CustomRange,
): Range {
  const now = new Date();
  const today = startOfDay(now);

  switch (p) {
    case "now":
      return { from: new Date(now.getTime() - 30 * 60_000), to: now };
    case "today": {
      const from = addDays(today, offset);
      return { from, to: offset === 0 ? now : addDays(from, 1) };
    }
    case "yesterday": {
      const from = addDays(today, -1 + offset);
      return { from, to: addDays(from, 1) };
    }
    case "last24h": {
      const to = new Date(now.getTime() + offset * DAY);
      return { from: new Date(to.getTime() - DAY), to: offset === 0 ? now : to };
    }
    case "last7": {
      const from = addDays(today, -6 + offset * 7);
      return { from, to: offset === 0 ? now : addDays(from, 7) };
    }
    case "last30": {
      const from = addDays(today, -29 + offset * 30);
      return { from, to: offset === 0 ? now : addDays(from, 30) };
    }
    case "last12months":
      return { from: startOfMonth(now, -11), to: now };
    case "wtd":
      return { from: startOfWeek(now), to: now };
    case "mtd":
      return { from: startOfMonth(now), to: now };
    case "ytd":
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case "alltime":
      return { from: new Date(now.getFullYear() - 2, 0, 1), to: now };
    case "custom": {
      const from = custom ? new Date(custom.from + "T00:00:00") : today;
      const to = custom ? new Date(custom.to + "T23:59:59") : now;
      return { from, to };
    }
  }
}

export function defaultGranularity(p: PeriodKey, spanMs?: number): Granularity {
  switch (p) {
    case "now":
      return "minute";
    case "today":
    case "yesterday":
    case "last24h":
      return "hourly";
    case "last7":
    case "last30":
    case "wtd":
    case "mtd":
      return "daily";
    case "last12months":
    case "ytd":
    case "alltime":
      return "monthly";
    case "custom": {
      const span = spanMs ?? 0;
      if (span <= 2 * DAY) return "hourly";
      if (span <= 95 * DAY) return "daily";
      return "monthly";
    }
  }
}

export function previousRange(r: Range): Range {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: new Date(r.from.getTime()) };
}

export function bucketStarts(r: Range, g: Granularity): Date[] {
  const out: Date[] = [];
  if (g === "monthly") {
    let cur = startOfMonth(r.from);
    while (cur.getTime() < r.to.getTime()) {
      out.push(new Date(cur));
      cur = startOfMonth(cur, 1);
    }
  } else if (g === "daily") {
    let cur = startOfDay(r.from);
    while (cur.getTime() < r.to.getTime()) {
      out.push(new Date(cur));
      cur = addDays(cur, 1);
    }
  } else {
    const step = g === "minute" ? 60_000 : HOUR;
    const t = new Date(r.from);
    if (g === "minute") t.setSeconds(0, 0);
    else t.setMinutes(0, 0, 0);
    let cur = t.getTime();
    while (cur < r.to.getTime()) {
      out.push(new Date(cur));
      cur += step;
    }
  }
  return out;
}

export function formatBucketLabel(
  d: Date,
  g: Granularity,
  tz = "Europe/Bucharest",
): string {
  if (g === "minute") {
    return d
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: tz,
      })
      .toLowerCase();
  }
  if (g === "hourly") {
    return d
      .toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: tz })
      .toLowerCase()
      .replace(" ", "");
  }
  if (g === "monthly") {
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: tz,
    });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz });
}

export function formatRangeLabel(r: Range, tz = "Europe/Bucharest"): string {
  const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: tz };
  const f = r.from.toLocaleDateString("en-US", opt);
  const toEnd = new Date(r.to.getTime() - 1);
  const t = toEnd.toLocaleDateString("en-US", opt);
  return f === t ? f : `${f} – ${t}`;
}

export function formatCurrentTime(tz = "Europe/Bucharest"): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });
}

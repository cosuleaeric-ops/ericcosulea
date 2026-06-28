// Range-uri de timp + bucketing. Pur, folosit pe client (dropdown) și server (serii).

export type Granularity = "hourly" | "daily";
export type PeriodKey = "today" | "yesterday" | "last7" | "last30" | "thismonth";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thismonth: "This month",
};

export const PERIOD_ORDER: PeriodKey[] = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "thismonth",
];

export function defaultGranularity(p: PeriodKey): Granularity {
  return p === "today" || p === "yesterday" ? "hourly" : "daily";
}

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

export type Range = { from: Date; to: Date };

// offset deplasează fereastra cu propria lungime (săgețile < >). 0 = perioada curentă.
export function computeRange(p: PeriodKey, offset = 0): Range {
  const now = new Date();
  const today = startOfDay(now);

  switch (p) {
    case "today": {
      const from = addDays(today, offset);
      const to = offset === 0 ? now : addDays(from, 1);
      return { from, to };
    }
    case "yesterday": {
      const from = addDays(today, -1 + offset);
      return { from, to: addDays(from, 1) };
    }
    case "last7": {
      const from = addDays(today, -6 + offset * 7);
      const to = offset === 0 ? now : addDays(from, 7);
      return { from, to };
    }
    case "last30": {
      const from = addDays(today, -29 + offset * 30);
      const to = offset === 0 ? now : addDays(from, 30);
      return { from, to };
    }
    case "thismonth": {
      const from = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const to =
        offset === 0
          ? now
          : new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
      return { from, to };
    }
  }
}

// Perioada imediat anterioară, de aceeași lungime (pentru delte și Compare).
export function previousRange(r: Range): Range {
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: new Date(r.from.getTime()) };
}

const HOUR = 3600_000;
const DAY = 86_400_000;

export function stepMs(g: Granularity): number {
  return g === "hourly" ? HOUR : DAY;
}

// Lista de start-uri de bucket pentru [from, to).
export function bucketStarts(r: Range, g: Granularity): Date[] {
  const out: Date[] = [];
  const step = stepMs(g);
  if (g === "daily") {
    let cur = startOfDay(r.from);
    while (cur.getTime() < r.to.getTime()) {
      out.push(new Date(cur));
      cur = addDays(cur, 1);
    }
  } else {
    let t = new Date(r.from);
    t.setMinutes(0, 0, 0);
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
  if (g === "hourly") {
    return d
      .toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: tz })
      .toLowerCase()
      .replace(" ", "");
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

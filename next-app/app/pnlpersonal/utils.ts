import type { PeriodOption } from "./types";

export const RO_MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

export const fmt = (n: number) =>
  new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const fmtRon = (n: number) => `${fmt(n)} lei`;

export const fmtDate = (s: string) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return s;
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
};

export const LAST_DATE_KEY = "pnlpersonal_last_date";

const RO_TZ = "Europe/Bucharest";

export const todayInRo = (timeZone = RO_TZ) =>
  new Date().toLocaleDateString("en-CA", { timeZone });

export const today = () => todayInRo();

export function addDaysYmd(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function weekdayIsoInRo(dateStr: string, timeZone = RO_TZ): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(new Date(`${dateStr}T12:00:00`));
  const map: Record<string, number> = {
    Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
  };
  return map[wd] ?? 1;
}

/** YYYY-MM-DD al lunei săptămânii care conține `dateStr` (timezone RO). */
export function mondayOfWeekRo(dateStr: string): string {
  const dow = weekdayIsoInRo(dateStr);
  return addDaysYmd(dateStr, -(dow - 1));
}

/** Banner portofel: de luni înainte, până există o intrare cu data ≥ lunea săptămânii curente. */
export function needsWalletUpdate(latestData: string | null | undefined): boolean {
  const monday = mondayOfWeekRo(todayInRo());
  if (!latestData) return true;
  return latestData < monday;
}

export const dayShift = (yyyymmdd: string, delta: number) => {
  const d = new Date(yyyymmdd || today());
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

export const periodLabel = (period: string) => {
  if (/^\d{4}$/.test(period)) return period;
  const [y, m] = period.split("-").map(Number);
  return `${RO_MONTHS[m - 1]} ${y}`;
};

export const daysInMonth = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

export const monthShift = (yyyymm: string, delta: number) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const matchPeriod = (date: string, period: string) => {
  if (/^\d{4}$/.test(period)) return date.startsWith(`${period}-`);
  return date.startsWith(period);
};

export function buildPeriods(availableMonths: string[], initialMonth: string): PeriodOption[] {
  const set = new Set<string>(availableMonths);
  set.add(initialMonth);
  const yearMap = new Map<string, string[]>();
  for (const m of set) {
    const [y] = m.split("-");
    if (!yearMap.has(y)) yearMap.set(y, []);
    yearMap.get(y)!.push(m);
  }
  const out: PeriodOption[] = [];
  for (const y of Array.from(yearMap.keys()).sort().reverse()) {
    out.push({ value: y, label: y, isYear: true });
    for (const m of yearMap.get(y)!.sort().reverse()) {
      const mm = parseInt(m.split("-")[1], 10);
      out.push({ value: m, label: `${RO_MONTHS[mm - 1]} ${y}`, isYear: false });
    }
  }
  return out;
}

export function getInitialAddDate(): string {
  if (typeof window === "undefined") return today();
  return localStorage.getItem(LAST_DATE_KEY) || today();
}

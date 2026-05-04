import type { Metadata } from "next";
import {
  getCategoriiCheltuiala,
  getCategoriiVenit,
  getCheltuieliByMonth,
  getCheltuieliByYear,
  getCheltuieliTotalByMonth,
  getDistinctMonthsWithEntries,
  getLastCheltuialaDate,
  getLatestPortofel,
  getPortofelByMonth,
  getPortofelByYear,
  getVenituriByMonth,
  getVenituriByYear,
} from "@/lib/db/queries";
import "./style.css";
import PnlApp from "./PnlApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "P&L — Personal",
  robots: { index: false, follow: false },
};

const RO_MONTHS = ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"];

const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthShift = (yyyymm: string, delta: number) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthLabel = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${RO_MONTHS[m - 1]} ${y}`;
};
const daysInMonth = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

type SP = Promise<{ m?: string }>;

export default async function PnlPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const raw = sp.m ?? currentMonth();
  const isYear = /^\d{4}$/.test(raw);
  const isMonth = /^\d{4}-\d{2}$/.test(raw);
  const period = isYear || isMonth ? raw : currentMonth();
  const periodIsYear = /^\d{4}$/.test(period);

  const [catVenit, catChelt, latest, monthsList, lastEntryDate] = await Promise.all([
    getCategoriiVenit(),
    getCategoriiCheltuiala(),
    getLatestPortofel(),
    getDistinctMonthsWithEntries(),
    getLastCheltuialaDate(),
  ]);

  let venituriList: Awaited<ReturnType<typeof getVenituriByMonth>>;
  let cheltList: Awaited<ReturnType<typeof getCheltuieliByMonth>>;
  let portofelList: Awaited<ReturnType<typeof getPortofelByMonth>>;
  let prevTotal = 0;
  let prevLabel = "";
  let monthLabelStr = "";
  let daysCount = 0;

  if (periodIsYear) {
    [venituriList, cheltList, portofelList] = await Promise.all([
      getVenituriByYear(period),
      getCheltuieliByYear(period),
      getPortofelByYear(period),
    ]);
    monthLabelStr = period;
  } else {
    const prevMonth = monthShift(period, -1);
    const [v, c, p, pt] = await Promise.all([
      getVenituriByMonth(period),
      getCheltuieliByMonth(period),
      getPortofelByMonth(period),
      getCheltuieliTotalByMonth(prevMonth),
    ]);
    venituriList = v; cheltList = c; portofelList = p; prevTotal = pt;
    prevLabel = monthLabel(prevMonth);
    monthLabelStr = monthLabel(period);
    daysCount = daysInMonth(period);
  }

  // Build periods grouped by year (year header + months indented under each)
  const yearMap = new Map<string, string[]>();
  for (const m of monthsList) {
    const [y] = m.split("-");
    if (!yearMap.has(y)) yearMap.set(y, []);
    yearMap.get(y)!.push(m);
  }
  if (!periodIsYear) {
    const [y] = period.split("-");
    if (!yearMap.has(y)) yearMap.set(y, []);
    if (!yearMap.get(y)!.includes(period)) yearMap.get(y)!.push(period);
  } else {
    if (!yearMap.has(period)) yearMap.set(period, []);
  }
  const sortedYears = Array.from(yearMap.keys()).sort().reverse();
  type PeriodOpt = { value: string; label: string; isYear: boolean };
  const periods: PeriodOpt[] = [];
  for (const y of sortedYears) {
    periods.push({ value: y, label: y, isYear: true });
    const months = yearMap.get(y)!.sort().reverse();
    for (const m of months) {
      const mm = parseInt(m.split("-")[1], 10);
      periods.push({ value: m, label: `${RO_MONTHS[mm - 1]} ${y}`, isYear: false });
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const isMonday = new Date().getDay() === 1;

  return (
    <PnlApp
      period={period}
      periodIsYear={periodIsYear}
      monthLabel={monthLabelStr}
      prevLabel={prevLabel}
      periods={periods}
      daysInMonth={daysCount}
      todayKey={todayKey}
      isMonday={isMonday}
      venituri={venituriList.map((v) => ({ id: v.id, data: v.data, descriere: v.descriere, suma: v.suma }))}
      cheltuieli={cheltList.map((c) => ({ id: c.id, data: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma }))}
      catVenit={catVenit.map((c) => c.nume)}
      catChelt={catChelt.map((c) => c.nume)}
      latestPortofel={latest ? { id: latest.id, data: latest.data, cash: latest.cash, ing: latest.ing, revolut: latest.revolut, trading212: latest.trading212 } : null}
      allPortofel={portofelList.map((p) => ({ id: p.id, data: p.data, cash: p.cash, ing: p.ing, revolut: p.revolut, trading212: p.trading212 }))}
      prevMonthTotalCheltuieli={prevTotal}
      lastEntryDate={lastEntryDate}
    />
  );
}

import type { Metadata } from "next";
import {
  getAllPortofel,
  getCategoriiCheltuiala,
  getCategoriiVenit,
  getCheltuieliByMonth,
  getCheltuieliTotalByMonth,
  getDistinctMonthsWithEntries,
  getLastCheltuialaDate,
  getLatestPortofel,
  getVenituriByMonth,
} from "@/lib/db/queries";
import "./style.css";
import PnlApp from "./PnlApp";

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
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : currentMonth();
  const prevMonth = monthShift(month, -1);

  const [venituriList, cheltList, catVenit, catChelt, latest, allPortofel, prevTotal, monthsList, lastEntryDate] = await Promise.all([
    getVenituriByMonth(month),
    getCheltuieliByMonth(month),
    getCategoriiVenit(),
    getCategoriiCheltuiala(),
    getLatestPortofel(),
    getAllPortofel(),
    getCheltuieliTotalByMonth(prevMonth),
    getDistinctMonthsWithEntries(),
    getLastCheltuialaDate(),
  ]);

  const monthYears = (monthsList.includes(month) ? monthsList : [month, ...monthsList]).map((m) => ({ value: m, label: monthLabel(m) }));
  const todayKey = new Date().toISOString().slice(0, 10);
  const isMonday = new Date().getDay() === 1;

  return (
    <PnlApp
      month={month}
      monthLabel={monthLabel(month)}
      prevLabel={monthLabel(prevMonth)}
      monthYears={monthYears}
      daysInMonth={daysInMonth(month)}
      todayKey={todayKey}
      isMonday={isMonday}
      venituri={venituriList.map((v) => ({ id: v.id, data: v.data, descriere: v.descriere, suma: v.suma }))}
      cheltuieli={cheltList.map((c) => ({ id: c.id, data: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma }))}
      catVenit={catVenit.map((c) => c.nume)}
      catChelt={catChelt.map((c) => c.nume)}
      latestPortofel={latest ? { id: latest.id, data: latest.data, cash: latest.cash, ing: latest.ing, revolut: latest.revolut, trading212: latest.trading212 } : null}
      allPortofel={allPortofel.map((p) => ({ id: p.id, data: p.data, cash: p.cash, ing: p.ing, revolut: p.revolut, trading212: p.trading212 }))}
      prevMonthTotalCheltuieli={prevTotal}
      lastEntryDate={lastEntryDate}
    />
  );
}

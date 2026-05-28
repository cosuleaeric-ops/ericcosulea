import type { Metadata } from "next";
import {
  getCheltuieliByYear,
  getCategoriiCheltuiala,
  getCategoriiVenit,
  getDistinctMonthsWithEntries,
  getLatestPortofel,
  getPortofelByYear,
  getVenituriByYear,
} from "@/lib/db/queries";
import "./style.css";
import PnlApp from "./PnlApp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "P&L — Personal",
  robots: { index: false, follow: false },
};

export default async function PnlPage() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const isMonday = new Date().getDay() === 1;
  const initialMonth = todayKey.slice(0, 7);
  const initialYear = initialMonth.slice(0, 4);

  const [venituri, cheltuieli, portofel, catVenit, catChelt, latest, availableMonths] = await Promise.all([
    getVenituriByYear(initialYear),
    getCheltuieliByYear(initialYear),
    getPortofelByYear(initialYear),
    getCategoriiVenit(),
    getCategoriiCheltuiala(),
    getLatestPortofel(),
    getDistinctMonthsWithEntries(),
  ]);

  return (
    <PnlApp
      initialMonth={initialMonth}
      loadedYear={initialYear}
      availableMonths={availableMonths}
      todayKey={todayKey}
      isMonday={isMonday}
      venituri={venituri.map((v) => ({ id: v.id, data: v.data, descriere: v.descriere, suma: v.suma }))}
      cheltuieli={cheltuieli.map((c) => ({ id: c.id, data: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma }))}
      catVenit={catVenit.map((c) => c.nume)}
      catChelt={catChelt.map((c) => c.nume)}
      latestPortofel={latest ? { id: latest.id, data: latest.data, cash: latest.cash, ing: latest.ing, revolut: latest.revolut, trading212: latest.trading212 } : null}
      portofel={portofel.map((p) => ({ id: p.id, data: p.data, cash: p.cash, ing: p.ing, revolut: p.revolut, trading212: p.trading212 }))}
    />
  );
}

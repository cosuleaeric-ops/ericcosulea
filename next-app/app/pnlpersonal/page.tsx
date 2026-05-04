import Link from "next/link";
import type { Metadata } from "next";
import {
  getCategoriiCheltuiala,
  getCategoriiVenit,
  getCheltuieliByMonth,
  getLatestPortofel,
  getAllPortofel,
  getVenituriByMonth,
} from "@/lib/db/queries";
import { CategorieCheltuialaForm, CategorieVenitForm, CheltuialaForm, PortofelForm, VenitForm } from "./AddForms";
import { deleteCheltuialaAction, deletePortofelAction, deleteVenitAction } from "./actions";
import DeleteRow from "./DeleteRow";

export const metadata: Metadata = {
  title: "P&L Personal",
  robots: { index: false, follow: false },
};

const RO_MONTHS = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

const fmtRon = (v: number) => v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " lei";
const fmtRoDate = (s: string) => {
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

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

type SP = Promise<{ m?: string }>;

export default async function PnlPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : currentMonth();
  const [venituriList, cheltList, catVenit, catChelt, latest, allPortofel] = await Promise.all([
    getVenituriByMonth(month),
    getCheltuieliByMonth(month),
    getCategoriiVenit(),
    getCategoriiCheltuiala(),
    getLatestPortofel(),
    getAllPortofel(),
  ]);

  const totalVenituri = venituriList.reduce((s, v) => s + v.suma, 0);
  const totalCheltuieli = cheltList.reduce((s, c) => s + c.suma, 0);
  const balance = totalVenituri - totalCheltuieli;
  const totalLichid = latest ? latest.cash + latest.ing + latest.revolut : 0;

  return (
    <main className="page">
      <section className="section">
        <Link className="post-back" href="/admin">← admin</Link>
        <div className="pnl-header">
          <h1 className="page-title">P&amp;L — {monthLabel(month)}</h1>
          <div className="pnl-month-nav">
            <Link href={`/pnlpersonal?m=${monthShift(month, -1)}`} className="btn">‹</Link>
            <Link href="/pnlpersonal" className="btn">azi</Link>
            <Link href={`/pnlpersonal?m=${monthShift(month, 1)}`} className="btn">›</Link>
          </div>
        </div>

        <div className="pnl-stats">
          <div className="pnl-stat-card pnl-stat-green">
            <div className="pnl-stat-label">Venituri</div>
            <div className="pnl-stat-value">{fmtRon(totalVenituri)}</div>
            <div className="pnl-stat-sub">{venituriList.length} intrări</div>
          </div>
          <div className="pnl-stat-card pnl-stat-red">
            <div className="pnl-stat-label">Cheltuieli</div>
            <div className="pnl-stat-value">{fmtRon(totalCheltuieli)}</div>
            <div className="pnl-stat-sub">{cheltList.length} intrări</div>
          </div>
          <div className={`pnl-stat-card ${balance >= 0 ? "pnl-stat-green" : "pnl-stat-red"}`}>
            <div className="pnl-stat-label">Diferență</div>
            <div className="pnl-stat-value">{fmtRon(balance)}</div>
            <div className="pnl-stat-sub">venituri − cheltuieli</div>
          </div>
        </div>

        <div className="pnl-portofel-block">
          <h2>💼 Portofel</h2>
          {latest ? (
            <div className="pnl-portofel-grid">
              <div className="pnl-stat-card pnl-stat-green"><div className="pnl-stat-label">Cash 💵</div><div className="pnl-stat-value">{fmtRon(latest.cash)}</div></div>
              <div className="pnl-stat-card"><div className="pnl-stat-label">ING 🏦</div><div className="pnl-stat-value">{fmtRon(latest.ing)}</div></div>
              <div className="pnl-stat-card pnl-stat-blue"><div className="pnl-stat-label">Revolut 💳</div><div className="pnl-stat-value">{fmtRon(latest.revolut)}</div></div>
              <div className="pnl-stat-card pnl-stat-gold"><div className="pnl-stat-label">Total Lichid 💰</div><div className="pnl-stat-value">{fmtRon(totalLichid)}</div></div>
              <div className="pnl-stat-card pnl-stat-purple"><div className="pnl-stat-label">Trading212 📈</div><div className="pnl-stat-value">{fmtRon(latest.trading212)}</div></div>
            </div>
          ) : (
            <p className="page-lead">Niciun snapshot încă.</p>
          )}
          <details>
            <summary>+ snapshot nou</summary>
            <PortofelForm defaults={latest} />
          </details>
          <details>
            <summary>istoric snapshot-uri ({allPortofel.length})</summary>
            <table className="reviews-table">
              <thead><tr><th>Data</th><th>Cash</th><th>ING</th><th>Revolut</th><th>Trading212</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {allPortofel.map((p) => (
                  <tr key={p.id}>
                    <td>{p.data}</td>
                    <td>{fmtRon(p.cash)}</td>
                    <td>{fmtRon(p.ing)}</td>
                    <td>{fmtRon(p.revolut)}</td>
                    <td>{fmtRon(p.trading212)}</td>
                    <td>{fmtRon(p.cash + p.ing + p.revolut + p.trading212)}</td>
                    <td><DeleteRow action={deletePortofelAction} id={p.id} label="Ștergi snapshot-ul?" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        <div className="pnl-section">
          <h2>💰 Venituri</h2>
          <VenitForm categorii={catVenit.map((c) => c.nume)} />
          <table className="reviews-table">
            <thead><tr><th>Data</th><th>Descriere</th><th>Sumă</th><th></th></tr></thead>
            <tbody>
              {venituriList.length === 0 ? (
                <tr><td colSpan={4}><span className="post-item-date">Niciun venit luna asta.</span></td></tr>
              ) : venituriList.map((v) => (
                <tr key={v.id}>
                  <td>{fmtRoDate(v.data)}</td>
                  <td>{v.descriere}</td>
                  <td>{fmtRon(v.suma)}</td>
                  <td><DeleteRow action={deleteVenitAction} id={v.id} label={`Ștergi "${v.descriere}"?`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <details><summary>+ categorie venit nouă</summary><CategorieVenitForm /></details>
        </div>

        <div className="pnl-section">
          <h2>💸 Cheltuieli</h2>
          <CheltuialaForm categorii={catChelt.map((c) => c.nume)} />
          <table className="reviews-table">
            <thead><tr><th>Data</th><th>Categorie</th><th>Detalii</th><th>Sumă</th><th></th></tr></thead>
            <tbody>
              {cheltList.length === 0 ? (
                <tr><td colSpan={5}><span className="post-item-date">Nicio cheltuială luna asta.</span></td></tr>
              ) : cheltList.map((c) => (
                <tr key={c.id}>
                  <td>{fmtRoDate(c.data)}</td>
                  <td>{c.categorie}</td>
                  <td>{c.detalii}</td>
                  <td>{fmtRon(c.suma)}</td>
                  <td><DeleteRow action={deleteCheltuialaAction} id={c.id} label={`Ștergi cheltuiala?`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <details><summary>+ categorie cheltuială nouă</summary><CategorieCheltuialaForm /></details>
        </div>
      </section>
    </main>
  );
}

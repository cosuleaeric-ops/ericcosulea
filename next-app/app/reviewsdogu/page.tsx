import Link from "next/link";
import type { Metadata } from "next";
import { buildGlovoReport, fmtRon, fmtRoDate, LABELS, RESTAURANT_KEYS } from "@/lib/reviewsdogu/report";
import BoltReportForm from "./BoltReportForm";
import ImportForm from "./ImportForm";

export const metadata: Metadata = {
  title: "Reviews & Comenzi - DOGU",
  robots: { index: false, follow: false },
};

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDefaultDates() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
  return {
    start: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toIsoDate(now),
  };
}

function getPeriodPresets() {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Bucharest" }));
  const thisStart = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const thisEnd = toIsoDate(now);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastStart = toIsoDate(new Date(lastDay.getFullYear(), lastDay.getMonth(), 1));
  const lastEnd = toIsoDate(lastDay);
  return [
    { label: "luna aceasta", href: `?platform=glovo&date_start=${thisStart}&date_end=${thisEnd}` },
    { label: "luna trecută", href: `?platform=glovo&date_start=${lastStart}&date_end=${lastEnd}` },
  ];
}

type SP = Promise<{ platform?: string; date_start?: string; date_end?: string }>;

export default async function ReviewsdoguPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const platform = sp.platform === "glovo" ? "glovo" : "bolt";

  const defaults = getDefaultDates();
  const start = sp.date_start ?? defaults.start;
  const end = sp.date_end ?? defaults.end;
  const presets = getPeriodPresets();

  let error: string | null = null;
  let glovoReport: Awaited<ReturnType<typeof buildGlovoReport>> | null = null;

  if (platform === "glovo") {
    if (start > end) error = "Data de start trebuie să fie înainte de data de final.";
    else {
      glovoReport = await buildGlovoReport(start, end);
      if (glovoReport.total === 0 && glovoReport.cancels.length === 0) {
        error = "Nu există comenzi în perioada selectată.";
        glovoReport = null;
      }
    }
  }

  return (
    <main className="page page-narrow">
      <section className="page-section">
        <Link className="post-back" href="/dogu">← dogu</Link>
        <h1 className="page-title">reviews & comenzi</h1>

        <div className="reviews-tabs">
          <a href="?platform=bolt" className={`btn${platform === "bolt" ? " reviews-tab-active" : ""}`}>Bolt</a>
          <a href={`?platform=glovo&date_start=${start}&date_end=${end}`} className={`btn${platform === "glovo" ? " reviews-tab-active" : ""}`}>Glovo</a>
        </div>

        {platform === "bolt" && (
          <BoltReportForm />
        )}

        {platform === "glovo" && (
          <>
            <form method="get" className="reviews-form">
              <input type="hidden" name="platform" value="glovo" />
              <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <label className="form-label" htmlFor="date_start">De la</label>
                  <input className="form-input" type="date" id="date_start" name="date_start" defaultValue={start} required />
                </div>
                <div>
                  <label className="form-label" htmlFor="date_end">Până la</label>
                  <input className="form-input" type="date" id="date_end" name="date_end" defaultValue={end} required />
                </div>
              </div>
              <div className="reviews-period-nav">
                {presets.map((p) => (
                  <a key={p.label} href={p.href} className="btn">{p.label}</a>
                ))}
                <button type="submit" className="btn">interval personalizat →</button>
              </div>
            </form>

            {error && <div className="vanzari-alert">{error}</div>}

            {glovoReport && (
              <>
                <div className="vanzari-report-header">
                  <div>
                    <span className="vanzari-badge">📊 Glovo</span>
                    <h2 className="vanzari-report-title">{glovoReport.total} comenzi · {fmtRoDate(glovoReport.periodStart)} → {fmtRoDate(glovoReport.periodEnd)}</h2>
                  </div>
                  <div className="vanzari-total-block">
                    <div className="vanzari-total-label">Total vânzări</div>
                    <div className="vanzari-total-value">{fmtRon(glovoReport.totalSales)}</div>
                  </div>
                </div>

                <div className="vanzari-section-title">Defalcat pe restaurante</div>
                <div className="vanzari-rest-grid">
                  {RESTAURANT_KEYS.map((k) => (
                    <div key={k} className="vanzari-rest-card">
                      <div className="vanzari-rest-label">{LABELS[k]}</div>
                      <div className="vanzari-rest-amount">{glovoReport.counts[k]} comenzi</div>
                      <div className="vanzari-rest-count">{fmtRon(glovoReport.sales[k])}</div>
                    </div>
                  ))}
                </div>

                <div className="vanzari-section-title">Taxe pentru timp de așteptare: <strong>{fmtRon(glovoReport.waitingTotal)}</strong></div>
                {glovoReport.waitingTax.length > 0 && (
                  <table className="reviews-table">
                    <thead><tr><th>Data</th><th>Ora</th><th>Restaurant</th><th>Sumă</th></tr></thead>
                    <tbody>
                      {glovoReport.waitingTax.map((w, i) => (
                        <tr key={i}><td>{fmtRoDate(w.date)}</td><td>{w.time ?? "—"}</td><td>{w.restaurant}</td><td>{fmtRon(w.amount ?? 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="vanzari-section-title">Rambursări partener: <strong>{fmtRon(glovoReport.refundTotal)}</strong></div>
                {glovoReport.refunds.length > 0 && (
                  <table className="reviews-table">
                    <thead><tr><th>Data</th><th>Restaurant</th><th>Sumă</th></tr></thead>
                    <tbody>
                      {glovoReport.refunds.map((r, i) => (
                        <tr key={i}><td>{fmtRoDate(r.date)}</td><td>{r.restaurant}</td><td>{fmtRon(r.amount ?? 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {glovoReport.cancels.length > 0 && (
                  <>
                    <div className="vanzari-section-title">Anulări ({glovoReport.cancels.length})</div>
                    <table className="reviews-table">
                      <thead><tr><th>Data</th><th>Restaurant</th><th>Motiv</th><th>Responsabil</th></tr></thead>
                      <tbody>
                        {glovoReport.cancels.map((c, i) => (
                          <tr key={i}><td>{fmtRoDate(c.date)}</td><td>{c.restaurant}</td><td>{c.reason}</td><td>{c.responsible}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {glovoReport.complaints.length > 0 && (
                  <>
                    <div className="vanzari-section-title">Reclamații ({glovoReport.complaints.length})</div>
                    <table className="reviews-table">
                      <thead><tr><th>Data</th><th>Restaurant</th><th>Motiv</th></tr></thead>
                      <tbody>
                        {glovoReport.complaints.map((c, i) => (
                          <tr key={i}><td>{fmtRoDate(c.date)}</td><td>{c.restaurant}</td><td>{c.reason}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}

            <details className="reviews-import">
              <summary>+ importă comenzi noi Glovo (XLSX)</summary>
              <ImportForm />
            </details>
          </>
        )}
      </section>
    </main>
  );
}

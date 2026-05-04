import Link from "next/link";
import type { Metadata } from "next";
import { buildBoltReport, buildGlovoReport, fmtRon, fmtRoDate, LABELS, RESTAURANT_KEYS } from "@/lib/reviewsdogu/report";

export const metadata: Metadata = {
  title: "Reviews & Comenzi - DOGU",
  robots: { index: false, follow: false },
};

type SP = Promise<{ platform?: string; date_start?: string; date_end?: string }>;

export default async function ReviewsdoguPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const platform = sp.platform === "bolt" || sp.platform === "glovo" ? sp.platform : null;
  const start = sp.date_start ?? "";
  const end = sp.date_end ?? "";

  let error: string | null = null;
  let report: Awaited<ReturnType<typeof buildBoltReport>> | Awaited<ReturnType<typeof buildGlovoReport>> | null = null;

  if (platform && start && end) {
    if (start > end) error = "Data de start trebuie să fie înainte de data de final.";
    else {
      report = platform === "bolt" ? await buildBoltReport(start, end) : await buildGlovoReport(start, end);
      if (report.total === 0 && (report.type === "glovo" ? report.cancels.length === 0 : true)) {
        error = "Nu există comenzi în perioada selectată.";
        report = null;
      }
    }
  }

  return (
    <main className="page page-narrow">
      <section className="page-section">
        <Link className="post-back" href="/dogu">← dogu</Link>
        <h1 className="page-title">reviews & comenzi</h1>
        <p className="page-lead">Raport pe interval de date din comenzile salvate (Bolt + Glovo).</p>

        <form method="get" className="reviews-form">
          <div className="form-row">
            <div>
              <label className="form-label" htmlFor="platform">Platformă</label>
              <select className="form-input" id="platform" name="platform" defaultValue={platform ?? "bolt"} required>
                <option value="bolt">Bolt</option>
                <option value="glovo">Glovo</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="date_start">De la</label>
              <input className="form-input" type="date" id="date_start" name="date_start" defaultValue={start} required />
            </div>
            <div>
              <label className="form-label" htmlFor="date_end">Până la</label>
              <input className="form-input" type="date" id="date_end" name="date_end" defaultValue={end} required />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn">Generează raport →</button>
          </div>
        </form>

        {error && <div className="vanzari-alert">{error}</div>}

        {report && (
          <>
            <div className="vanzari-report-header">
              <div>
                <span className="vanzari-badge">📊 {report.platform}</span>
                <h2 className="vanzari-report-title">{report.total} comenzi · {fmtRoDate(report.periodStart)} → {fmtRoDate(report.periodEnd)}</h2>
              </div>
              <div className="vanzari-total-block">
                <div className="vanzari-total-label">Total vânzări</div>
                <div className="vanzari-total-value">{fmtRon(report.totalSales)}</div>
              </div>
            </div>

            <div className="vanzari-section-title">Defalcat pe restaurante</div>
            <div className="vanzari-rest-grid">
              {RESTAURANT_KEYS.map((k) => (
                <div key={k} className="vanzari-rest-card">
                  <div className="vanzari-rest-label">{LABELS[k]}</div>
                  <div className="vanzari-rest-amount">{report.counts[k]} comenzi</div>
                  <div className="vanzari-rest-count">{fmtRon(report.sales[k])}</div>
                </div>
              ))}
            </div>

            {report.type === "bolt" && (
              <>
                <div className="vanzari-section-title">Rating-uri</div>
                <table className="reviews-table">
                  <thead>
                    <tr><th>Restaurant</th><th>★ pozitive (4-5)</th><th>★ negative (1-3)</th></tr>
                  </thead>
                  <tbody>
                    {RESTAURANT_KEYS.map((k) => (
                      <tr key={k}>
                        <td>{LABELS[k]}</td>
                        <td>{report.positive[k]}</td>
                        <td>{report.negative[k]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {RESTAURANT_KEYS.flatMap((k) => report.comments[k]).length > 0 && (
                  <>
                    <div className="vanzari-section-title">Comentarii</div>
                    <ul className="reviews-comments">
                      {RESTAURANT_KEYS.flatMap((k) => report.comments[k]).map((c, i) => (
                        <li key={i}>
                          <div className="reviews-comment-meta">
                            <strong>{c.provider}</strong> · {fmtRoDate(c.date)} · {"★".repeat(c.rating)}{"☆".repeat(5 - c.rating)}
                          </div>
                          <div className="reviews-comment-text">{c.comment}</div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            {report.type === "glovo" && (
              <>
                <div className="vanzari-section-title">Taxe pentru timp de așteptare: <strong>{fmtRon(report.waitingTotal)}</strong></div>
                {report.waitingTax.length > 0 && (
                  <table className="reviews-table">
                    <thead><tr><th>Data</th><th>Ora</th><th>Restaurant</th><th>Sumă</th></tr></thead>
                    <tbody>
                      {report.waitingTax.map((w, i) => (
                        <tr key={i}><td>{fmtRoDate(w.date)}</td><td>{w.time ?? "—"}</td><td>{w.restaurant}</td><td>{fmtRon(w.amount ?? 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div className="vanzari-section-title">Rambursări partener: <strong>{fmtRon(report.refundTotal)}</strong></div>
                {report.refunds.length > 0 && (
                  <table className="reviews-table">
                    <thead><tr><th>Data</th><th>Restaurant</th><th>Sumă</th></tr></thead>
                    <tbody>
                      {report.refunds.map((r, i) => (
                        <tr key={i}><td>{fmtRoDate(r.date)}</td><td>{r.restaurant}</td><td>{fmtRon(r.amount ?? 0)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {report.cancels.length > 0 && (
                  <>
                    <div className="vanzari-section-title">Anulări ({report.cancels.length})</div>
                    <table className="reviews-table">
                      <thead><tr><th>Data</th><th>Restaurant</th><th>Motiv</th><th>Responsabil</th></tr></thead>
                      <tbody>
                        {report.cancels.map((c, i) => (
                          <tr key={i}><td>{fmtRoDate(c.date)}</td><td>{c.restaurant}</td><td>{c.reason}</td><td>{c.responsible}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                {report.complaints.length > 0 && (
                  <>
                    <div className="vanzari-section-title">Reclamații ({report.complaints.length})</div>
                    <table className="reviews-table">
                      <thead><tr><th>Data</th><th>Restaurant</th><th>Motiv</th></tr></thead>
                      <tbody>
                        {report.complaints.map((c, i) => (
                          <tr key={i}><td>{fmtRoDate(c.date)}</td><td>{c.restaurant}</td><td>{c.reason}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

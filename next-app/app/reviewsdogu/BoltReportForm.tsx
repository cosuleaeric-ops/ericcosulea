"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { boltReportAction, type BoltReportState } from "./actions";
import { RESTAURANT_KEYS, LABELS, fmtRon, fmtRoDate } from "@/lib/reviewsdogu/report";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "se procesează..." : "Generează raport →"}
    </button>
  );
}

export default function BoltReportForm() {
  const [state, action] = useActionState<BoltReportState, FormData>(boltReportAction, undefined);
  const report = state?.report;

  return (
    <>
      <form action={action} className="reviews-form">
        <div>
          <label className="form-label" htmlFor="bolt_csv">Fișiere CSV Bolt (multiple ok)</label>
          <input className="form-input" type="file" id="bolt_csv" name="bolt_csv" accept=".csv" multiple required />
        </div>
        <div className="form-actions">
          <SubmitButton />
        </div>
        {state?.error && <div className="vanzari-alert">{state.error}</div>}
      </form>

      {report && (
        <>
          <div className="vanzari-report-header">
            <div>
              <span className="vanzari-badge">📊 Bolt</span>
              <h2 className="vanzari-report-title">
                {report.total} comenzi · {fmtRoDate(report.periodStart)} → {fmtRoDate(report.periodEnd)}
              </h2>
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
    </>
  );
}

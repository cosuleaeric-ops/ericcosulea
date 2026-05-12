"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { glovoReportAction, type GlovoReportState } from "./actions";
import { RESTAURANT_KEYS, LABELS, fmtRon, fmtRoDate } from "@/lib/reviewsdogu/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "se procesează..." : "Generează raport →"}
    </button>
  );
}

export default function GlovoReportForm() {
  const [state, action] = useActionState<GlovoReportState, FormData>(glovoReportAction, undefined);
  const report = state?.report;

  return (
    <>
      <form action={action} className="reviews-form">
        <div>
          <label className="form-label" htmlFor="glovo_files">Fișiere Glovo (.csv sau .xlsx, multiple ok)</label>
          <input className="form-input" type="file" id="glovo_files" name="glovo_files" accept=".csv,.xlsx" multiple required />
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
              <span className="vanzari-badge">📊 Glovo</span>
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
  );
}

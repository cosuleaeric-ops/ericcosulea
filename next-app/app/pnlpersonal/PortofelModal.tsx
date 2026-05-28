"use client";

import { useState, useTransition } from "react";
import { addPortofelAction, editPortofelAction } from "./actions";
import type { Portofel } from "./types";
import { fmtRon, today } from "./utils";

type Props = {
  row: Portofel | null;
  prefill: Portofel | null;
  onClose: () => void;
  onSaved: () => void;
};

export function PortofelModal({ row, prefill, onClose, onSaved }: Props) {
  const isEdit = row != null;
  const initial = row ?? prefill;
  const [data, setData] = useState(initial?.data ?? today());
  const [cash, setCash] = useState(initial ? String(initial.cash) : "");
  const [ing, setIng] = useState(initial ? String(initial.ing) : "");
  const [revolut, setRevolut] = useState(initial ? String(initial.revolut) : "");
  const [trading212, setTrading212] = useState(initial ? String(initial.trading212) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const total = (parseFloat(cash) || 0) + (parseFloat(ing) || 0) + (parseFloat(revolut) || 0);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    if (isEdit && row) fd.set("id", String(row.id));
    fd.set("data", data);
    fd.set("cash", cash || "0");
    fd.set("ing", ing || "0");
    fd.set("revolut", revolut || "0");
    fd.set("trading212", trading212 || "0");
    startTransition(async () => {
      const res = await (isEdit ? editPortofelAction : addPortofelAction)(undefined, fd);
      if (res?.error) setError(res.error);
      else onSaved();
    });
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{isEdit ? "Editează portofelul" : "Actualizează portofelul"}</h2>
        {error && <div className="error-msg" style={{ display: "block" }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div className="portofel-form-grid">
            <div className="form-group">
              <label>Cash 💵 (lei)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={cash} onChange={(e) => setCash(e.target.value)} />
            </div>
            <div className="form-group">
              <label>ING 🏦 (lei)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={ing} onChange={(e) => setIng(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Revolut 💳 (lei)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={revolut} onChange={(e) => setRevolut(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Trading212 📈 (lei)</label>
              <input type="number" step="0.01" min="0" placeholder="0.00" value={trading212} onChange={(e) => setTrading212(e.target.value)} />
            </div>
          </div>
          <div className="portofel-total-row">
            <span className="total-label">Total lichid (cash + ING + Revolut)</span>
            <span className="total-value">{fmtRon(total)}</span>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Anulează</button>
            <button type="submit" className="btn btn-blue" disabled={pending}>{pending ? "..." : (isEdit ? "Salvează" : "Adaugă")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addCategorieCheltuialaAction, addCheltuialaAction, editCheltuialaAction } from "./actions";
import { CategorieCombobox, resolveCategorie } from "./CategorieCombobox";
import { catLabel } from "./catEmoji";
import type { Cheltuiala } from "./types";
import { dayShift, getInitialAddDate } from "./utils";

type Props = {
  row: Cheltuiala | null;
  catChelt: string[];
  onClose: () => void;
  onSavedEdit: () => void;
  onSavedAdd: (savedDate: string) => void;
};

export function CheltuialaModal({ row, catChelt, onClose, onSavedEdit, onSavedAdd }: Props) {
  const isEdit = row != null;
  const [data, setData] = useState(row?.data ?? getInitialAddDate());
  const [catInput, setCatInput] = useState(row ? catLabel(row.categorie, "cheltuiala") : "");
  const [suma, setSuma] = useState(row ? String(row.suma) : "");
  const [detalii, setDetalii] = useState(row?.detalii ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const sumaRef = useRef<HTMLInputElement>(null);

  useEffect(() => { sumaRef.current?.focus(); }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const cat = resolveCategorie(catInput, catChelt, "cheltuiala");
    if (!cat) { setError("Selectează sau scrie o categorie."); return; }
    if (cat.isNew) {
      setCreating(true);
      const fd = new FormData(); fd.set("nume", cat.nume);
      const res = await addCategorieCheltuialaAction(undefined, fd);
      setCreating(false);
      if (res?.error) { setError(res.error); return; }
    }
    const fd = new FormData();
    if (isEdit && row) fd.set("id", String(row.id));
    fd.set("data", data);
    fd.set("categorie", cat.nume);
    fd.set("detalii", detalii);
    fd.set("suma", suma);
    startTransition(async () => {
      const res = await (isEdit ? editCheltuialaAction : addCheltuialaAction)(undefined, fd);
      if (res?.error) { setError(res.error); return; }
      if (isEdit) {
        onSavedEdit();
      } else {
        onSavedAdd(data);
        setSuma("");
        setDetalii("");
        sumaRef.current?.focus();
      }
    });
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{isEdit ? "Editează cheltuiala" : "Adaugă cheltuiala"}</h2>
        {error && <div className="error-msg" style={{ display: "block" }}>{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            <div className="date-nav-row">
              <button type="button" className="date-nav-btn" onClick={() => setData(dayShift(data, -1))}>‹</button>
              <button type="button" className="date-nav-btn" onClick={() => setData(dayShift(data, 1))}>›</button>
            </div>
          </div>
          <div className="form-group">
            <label>Categorie</label>
            <CategorieCombobox value={catInput} onChange={setCatInput} cats={catChelt} kind="cheltuiala" />
          </div>
          <div className="form-group">
            <label>Sumă (lei)</label>
            <input ref={sumaRef} type="number" step="0.01" min="0.01" value={suma} onChange={(e) => setSuma(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Detalii</label>
            <input type="text" value={detalii} onChange={(e) => setDetalii(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Anulează</button>
            <button type="submit" className="btn btn-red" disabled={pending || creating}>{pending || creating ? "..." : (isEdit ? "Salvează" : "Adaugă")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

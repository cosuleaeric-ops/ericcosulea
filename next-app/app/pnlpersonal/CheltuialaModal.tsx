"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addCategorieCheltuialaAction, addCheltuialaAction, editCheltuialaAction } from "./actions";
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
  const [catInput, setCatInput] = useState(row?.categorie ?? (catChelt[0] ?? ""));
  const [showSugg, setShowSugg] = useState(false);
  const [suggIdx, setSuggIdx] = useState(-1);
  const [suma, setSuma] = useState(row ? String(row.suma) : "");
  const [detalii, setDetalii] = useState(row?.detalii ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const sumaRef = useRef<HTMLInputElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);
  const typedRef = useRef(row?.categorie ?? (catChelt[0] ?? ""));

  const suggestions = catChelt.filter((c) => c.toLowerCase().includes(catInput.toLowerCase()));
  const isNew = catInput.trim() !== "" && !catChelt.some((c) => c.toLowerCase() === catInput.trim().toLowerCase());

  useEffect(() => { sumaRef.current?.focus(); }, []);

  const selectSugg = (c: string) => { typedRef.current = c; setCatInput(c); setShowSugg(false); setSuggIdx(-1); };

  const onCatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value;
    typedRef.current = typed;
    setShowSugg(true);
    setSuggIdx(-1);
    if (!typed) { setCatInput(""); return; }
    const match = catChelt.find((c) => c.toLowerCase().startsWith(typed.toLowerCase()));
    if (match && match.toLowerCase() !== typed.toLowerCase()) {
      setCatInput(match);
      requestAnimationFrame(() => {
        catInputRef.current?.setSelectionRange(typed.length, match.length);
      });
    } else {
      setCatInput(typed);
    }
  };

  const onCatKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && catInputRef.current) {
      const el = catInputRef.current;
      if (el.selectionStart !== el.selectionEnd) {
        e.preventDefault();
        const newVal = el.value.slice(0, el.selectionStart!);
        typedRef.current = newVal;
        setCatInput(newVal);
      }
      return;
    }
    if (!showSugg) { if (e.key === "ArrowDown") { setShowSugg(true); setSuggIdx(0); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSuggIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSuggIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && suggIdx >= 0) { e.preventDefault(); selectSugg(suggestions[suggIdx]); }
    else if (e.key === "Escape") { setShowSugg(false); }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const numeCat = catInput.trim();
    if (!numeCat) { setError("Selectează sau scrie o categorie."); return; }
    let categorie = numeCat;
    if (isNew) {
      setCreating(true);
      const fd = new FormData(); fd.set("nume", numeCat);
      const res = await addCategorieCheltuialaAction(undefined, fd);
      setCreating(false);
      if (res?.error) { setError(res.error); return; }
      categorie = numeCat;
    }
    const fd = new FormData();
    if (isEdit && row) fd.set("id", String(row.id));
    fd.set("data", data);
    fd.set("categorie", categorie);
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
          <div className="form-group" style={{ position: "relative" }}>
            <label>Categorie{isNew && <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted)" }}>— categorie nouă</span>}</label>
            <input
              ref={catInputRef}
              type="text"
              value={catInput}
              autoComplete="off"
              onChange={onCatChange}
              onFocus={(e) => { e.target.select(); setShowSugg(true); }}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
              onKeyDown={onCatKey}
              placeholder="Scrie sau caută categorie..."
            />
            {showSugg && suggestions.length > 0 && (
              <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, margin: 0, padding: 0, listStyle: "none", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
                {suggestions.map((c, i) => (
                  <li key={c} onMouseDown={() => selectSugg(c)} style={{ padding: "9px 12px", cursor: "pointer", fontSize: 14, background: i === suggIdx ? "var(--bg-hover, #f5f0e8)" : undefined }}>
                    {c}
                  </li>
                ))}
              </ul>
            )}
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

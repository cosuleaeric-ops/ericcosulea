"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCheltuialaAction,
  addVenitAction,
  addPortofelAction,
  deleteCheltuialaAction,
  deletePortofelAction,
  deleteVenitAction,
  editCheltuialaAction,
  editVenitAction,
  editPortofelAction,
} from "./actions";

type Venit = { id: number; data: string; descriere: string; suma: number };
type Cheltuiala = { id: number; data: string; categorie: string; detalii: string; suma: number };
type Portofel = { id: number; data: string; cash: number; ing: number; revolut: number; trading212: number };

type Props = {
  month: string;
  monthLabel: string;
  prevLabel: string;
  monthYears: { value: string; label: string }[];
  daysInMonth: number;
  todayKey: string;
  isMonday: boolean;
  venituri: Venit[];
  cheltuieli: Cheltuiala[];
  catVenit: string[];
  catChelt: string[];
  latestPortofel: Portofel | null;
  allPortofel: Portofel[];
  prevMonthTotalCheltuieli: number;
  lastEntryDate: string | null;
};

const fmt = (n: number) => new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtRon = (n: number) => `${fmt(n)} lei`;
const fmtDate = (s: string) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  if (!y) return s;
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
};
const today = () => new Date().toISOString().slice(0, 10);
const monthShift = (yyyymm: string, delta: number) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type Tab = "toate" | "venituri" | "cheltuieli";

type ModalState =
  | { kind: "none" }
  | { kind: "venit"; row: Venit | null }
  | { kind: "cheltuiala"; row: Cheltuiala | null }
  | { kind: "portofel"; row: Portofel | null };

export default function PnlApp(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("toate");
  const [filterCategorie, setFilterCategorie] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [hideSums, setHideSums] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.body.classList.toggle("hide-sums", hideSums);
    return () => document.body.classList.remove("hide-sums");
  }, [hideSums]);

  const totalVenituri = props.venituri.reduce((s, v) => s + v.suma, 0);
  const totalCheltuieli = props.cheltuieli.reduce((s, c) => s + c.suma, 0);
  const medieZilnica = totalCheltuieli / props.daysInMonth;
  const fataDeTrecuta = props.prevMonthTotalCheltuieli > 0
    ? ((totalCheltuieli - props.prevMonthTotalCheltuieli) / props.prevMonthTotalCheltuieli) * 100
    : 0;

  const latestTotalLichid = props.latestPortofel
    ? props.latestPortofel.cash + props.latestPortofel.ing + props.latestPortofel.revolut
    : 0;

  const topCategorii = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of props.cheltuieli) {
      map.set(c.categorie, (map.get(c.categorie) ?? 0) + c.suma);
    }
    const arr = Array.from(map, ([categorie, suma]) => ({ categorie, suma }));
    arr.sort((a, b) => b.suma - a.suma);
    return arr;
  }, [props.cheltuieli]);
  const maxCategorieAmount = topCategorii[0]?.suma ?? 0;

  const filteredCategorii = filterCategorie ? new Set([filterCategorie]) : null;
  const txList = useMemo(() => {
    const all: Array<{ kind: "venit" | "cheltuiala"; date: string; categorie: string; detalii: string; suma: number; id: number }> = [];
    if (tab !== "cheltuieli") {
      for (const v of props.venituri) {
        if (filteredCategorii && !filteredCategorii.has(v.descriere)) continue;
        all.push({ kind: "venit", date: v.data, categorie: v.descriere, detalii: "", suma: v.suma, id: v.id });
      }
    }
    if (tab !== "venituri") {
      for (const c of props.cheltuieli) {
        if (filteredCategorii && !filteredCategorii.has(c.categorie)) continue;
        all.push({ kind: "cheltuiala", date: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma, id: c.id });
      }
    }
    all.sort((a, b) => (b.date.localeCompare(a.date)) || (b.id - a.id));
    return all;
  }, [props.venituri, props.cheltuieli, tab, filterCategorie]);

  const txCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    if (tab !== "cheltuieli") for (const v of props.venituri) set.add(v.descriere);
    if (tab !== "venituri") for (const c of props.cheltuieli) set.add(c.categorie);
    return Array.from(set).sort();
  }, [props.venituri, props.cheltuieli, tab]);

  const goMonth = (m: string) => router.push(`/pnlpersonal?m=${m}`);

  const onDelete = (kind: "venit" | "cheltuiala" | "portofel", id: number, label: string) => {
    if (!confirm(label)) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      if (kind === "venit") await deleteVenitAction(fd);
      else if (kind === "cheltuiala") await deleteCheltuialaAction(fd);
      else await deletePortofelAction(fd);
      router.refresh();
    });
  };

  return (
    <>
      <header className="app-header">
        <h1>P&amp;L — Personal</h1>
        <div className="header-controls">
          <button className="month-nav-btn" onClick={() => goMonth(monthShift(props.month, -1))} title="Luna anterioară">‹</button>
          <button className="month-nav-btn" onClick={() => goMonth(monthShift(props.month, 1))} title="Luna următoare">›</button>
          <select
            className="year-select"
            value={props.month}
            onChange={(e) => goMonth(e.target.value)}
          >
            {props.monthYears.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <a href="/admin" className="logout-link">← Admin</a>
        </div>
      </header>

      {props.isMonday && !bannerClosed && (
        <div className="monday-banner visible">
          <span className="banner-icon">🔔</span>
          <span className="banner-text">E luni! Nu uita să actualizezi valorile din portofel.</span>
          <button className="banner-btn" onClick={() => setModal({ kind: "portofel", row: props.latestPortofel })}>Actualizează portofelul</button>
          <button className="banner-close" onClick={() => setBannerClosed(true)}>×</button>
        </div>
      )}

      <main className="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}></span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setHideSums((v) => !v)}
              title="Ascunde/Arată sumele"
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14, lineHeight: 1, color: "var(--muted)" }}
            >👁</button>
            {props.lastEntryDate && (
              <span className="last-entry-badge">Ultima cheltuială: {fmtDate(props.lastEntryDate)}</span>
            )}
          </div>
        </div>

        <div className="quick-add-bar">
          <button className="quick-add-btn quick-add-cheltuiala" onClick={() => setModal({ kind: "cheltuiala", row: null })}>
            <span className="qab-icon">−</span><span className="qab-text">Adaugă cheltuială</span>
          </button>
          <button className="quick-add-btn quick-add-venit" onClick={() => setModal({ kind: "venit", row: null })}>
            <span className="qab-icon">+</span><span className="qab-text">Adaugă venit</span>
          </button>
        </div>

        <div>
          <div className="section-title-bar">
            <h2>💼 Portofel</h2>
          </div>
          <div className="portofel-history">
            <div className="portofel-history-header" onClick={() => setShowHistory((v) => !v)}>
              <span>Detalii &amp; Istoric</span>
              <span className="toggle-icon" style={{ transform: showHistory ? "rotate(180deg)" : "" }}>▼</span>
            </div>
            {showHistory && (
              <div className="portofel-history-body" style={{ display: "block" }}>
                <div className="portofel-grid portofel-grid-inner">
                  <div className="stat-card accent-green"><div className="label">Cash 💵</div><div className="value green">{props.latestPortofel ? fmtRon(props.latestPortofel.cash) : "—"}</div><div className="sub">portofel fizic</div></div>
                  <div className="stat-card accent-orange"><div className="label">ING 🏦</div><div className="value" style={{ color: "#E8704A" }}>{props.latestPortofel ? fmtRon(props.latestPortofel.ing) : "—"}</div><div className="sub">cont curent</div></div>
                  <div className="stat-card accent-blue"><div className="label">Revolut 💳</div><div className="value blue">{props.latestPortofel ? fmtRon(props.latestPortofel.revolut) : "—"}</div><div className="sub">cont digital</div></div>
                  <div className="stat-card accent-gold"><div className="label">Total Lichid 💰</div><div className="value gold">{props.latestPortofel ? fmtRon(latestTotalLichid) : "—"}</div><div className="sub">cash + ing + revolut</div></div>
                  <div className="stat-card accent-purple"><div className="label">Trading212 📈</div><div className="value purple">{props.latestPortofel ? fmtRon(props.latestPortofel.trading212) : "—"}</div><div className="sub">investiții</div></div>
                </div>
                <div className="portofel-meta portofel-meta-inner">
                  <span>{props.latestPortofel ? `Ultima actualizare: ${fmtDate(props.latestPortofel.data)}` : "Niciun snapshot"}</span>
                  {props.latestPortofel && <>
                    <span>·</span>
                    <a className="update-link" onClick={() => setModal({ kind: "portofel", row: props.latestPortofel })} style={{ cursor: "pointer" }}>Editează ultima intrare</a>
                  </>}
                  <span>·</span>
                  <button className="btn btn-blue btn-sm" onClick={() => setModal({ kind: "portofel", row: null })}>+ Actualizează</button>
                </div>
                {props.allPortofel.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 110 }}>Data</th>
                        <th className="right">Cash</th>
                        <th className="right">ING</th>
                        <th className="right">Revolut</th>
                        <th className="right">Lichid</th>
                        <th className="right">Trading212</th>
                        <th style={{ width: 60 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {props.allPortofel.map((p) => (
                        <tr key={p.id}>
                          <td>{fmtDate(p.data)}</td>
                          <td className="right">{fmtRon(p.cash)}</td>
                          <td className="right">{fmtRon(p.ing)}</td>
                          <td className="right">{fmtRon(p.revolut)}</td>
                          <td className="right">{fmtRon(p.cash + p.ing + p.revolut)}</td>
                          <td className="right">{fmtRon(p.trading212)}</td>
                          <td className="right">
                            <button className="link-btn" onClick={() => setModal({ kind: "portofel", row: p })}>✎</button>
                            <button className="link-btn delete-btn" onClick={() => onDelete("portofel", p.id, "Ștergi snapshot-ul?")} disabled={pending}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>

        <hr className="section-divider" />

        <div className="stats-grid">
          <div className="stat-card accent-green">
            <div className="label">Venituri totale</div>
            <div className="value green">{fmtRon(totalVenituri)}</div>
            <div className="sub">{props.venituri.length} intrări</div>
          </div>
          <div className="stat-card accent-red">
            <div className="label">Cheltuieli totale</div>
            <div className="value red">{fmtRon(totalCheltuieli)}</div>
            <div className="sub">{props.cheltuieli.length} intrări</div>
          </div>
          <div className="stat-card">
            <div className="label">Medie zilnică</div>
            <div className="value">{fmtRon(medieZilnica)}</div>
            <div className="sub">din {props.daysInMonth} zile</div>
          </div>
          <div className="stat-card">
            <div className="label">Față de {props.prevLabel}</div>
            <div className="value" style={{ color: fataDeTrecuta > 0 ? "var(--red)" : "var(--green)" }}>
              {props.prevMonthTotalCheltuieli === 0 ? "—" : `${fataDeTrecuta > 0 ? "+" : ""}${fataDeTrecuta.toFixed(1)}%`}
            </div>
            <div className="sub">{fmtRon(props.prevMonthTotalCheltuieli)} atunci</div>
          </div>
        </div>

        {topCategorii.length > 0 && (
          <div className="chart-card cumulative-card">
            <h3>Top categorii</h3>
            <div className="ranking-wrap" style={{ padding: "10px 0" }}>
              {topCategorii.slice(0, 8).map((c) => (
                <div key={c.categorie} className="ranking-row">
                  <div className="ranking-label">{c.categorie}</div>
                  <div className="ranking-bar-wrap">
                    <div className="ranking-bar" style={{ width: `${(c.suma / maxCategorieAmount) * 100}%` }} />
                  </div>
                  <div className="ranking-amount">{fmtRon(c.suma)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="tx-section">
          <div className="section-header">
            <h2>Tranzacții</h2>
            <div className="tab-group">
              {(["toate", "venituri", "cheltuieli"] as Tab[]).map((t) => (
                <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => { setTab(t); setFilterCategorie(null); }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <div className="add-btns">
              <button className="btn btn-green" onClick={() => setModal({ kind: "venit", row: null })}>+ Venit</button>
              <button className="btn btn-red" onClick={() => setModal({ kind: "cheltuiala", row: null })}>+ Cheltuiala</button>
            </div>
          </div>

          {txCategoryOptions.length > 0 && (
            <div className="cat-filter-bar">
              {filterCategorie && (
                <button className="cat-chip active" onClick={() => setFilterCategorie(null)}>× {filterCategorie}</button>
              )}
              {!filterCategorie && txCategoryOptions.map((c) => (
                <button key={c} className="cat-chip" onClick={() => setFilterCategorie(c)}>{c}</button>
              ))}
            </div>
          )}

          <div className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Data</th>
                    <th>Categorie</th>
                    <th className="right">Sumă (lei)</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {txList.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>Nicio tranzacție.</td></tr>
                  ) : txList.map((t) => (
                    <tr key={`${t.kind}-${t.id}`}>
                      <td>{fmtDate(t.date)}</td>
                      <td>
                        {t.categorie}
                        {t.detalii && <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: 12 }}>{t.detalii}</span>}
                      </td>
                      <td className={`right ${t.kind === "venit" ? "green" : "red"}`}>
                        {t.kind === "venit" ? "+" : "−"} {fmt(t.suma)}
                      </td>
                      <td className="right">
                        <button className="link-btn" onClick={() => {
                          if (t.kind === "venit") {
                            const row = props.venituri.find((v) => v.id === t.id);
                            if (row) setModal({ kind: "venit", row });
                          } else {
                            const row = props.cheltuieli.find((c) => c.id === t.id);
                            if (row) setModal({ kind: "cheltuiala", row });
                          }
                        }}>✎</button>
                        <button className="link-btn delete-btn" disabled={pending} onClick={() => onDelete(t.kind, t.id, `Ștergi această ${t.kind}?`)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {modal.kind !== "none" && (
        <ModalDialog
          modal={modal}
          catVenit={props.catVenit}
          catChelt={props.catChelt}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => { setModal({ kind: "none" }); router.refresh(); }}
        />
      )}
    </>
  );
}

function ModalDialog({
  modal, catVenit, catChelt, onClose, onSaved,
}: {
  modal: Exclude<ModalState, { kind: "none" }>;
  catVenit: string[];
  catChelt: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  type AnyAction = (prev: { error?: string } | undefined, fd: FormData) => Promise<{ error?: string } | undefined>;
  const handle = (formAction: AnyAction) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await formAction(undefined, fd);
      if (res?.error) setError(res.error);
      else onSaved();
    });
  };

  if (modal.kind === "venit") {
    const isEdit = modal.row != null;
    return (
      <div className="modal-overlay visible" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal">
          <button className="modal-close" onClick={onClose}>×</button>
          <h2>{isEdit ? "Editează venit" : "Adaugă venit"}</h2>
          {error && <div className="error-msg" style={{ display: "block" }}>{error}</div>}
          <form onSubmit={handle(isEdit ? editVenitAction : addVenitAction)}>
            {isEdit && <input type="hidden" name="id" value={modal.row!.id} />}
            <div className="form-group">
              <label>Data</label>
              <input type="date" name="data" defaultValue={modal.row?.data ?? today()} required />
            </div>
            <div className="form-group">
              <label>Categorie / Descriere</label>
              <input type="text" name="descriere" defaultValue={modal.row?.descriere ?? ""} list="venit-cats" required />
              <datalist id="venit-cats">
                {catVenit.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Sumă (lei)</label>
              <input type="number" name="suma" step="0.01" min="0.01" defaultValue={modal.row?.suma ?? ""} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Anulează</button>
              <button type="submit" className="btn btn-green" disabled={pending}>{pending ? "..." : "Salvează"}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (modal.kind === "cheltuiala") {
    const isEdit = modal.row != null;
    return (
      <div className="modal-overlay visible" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal">
          <button className="modal-close" onClick={onClose}>×</button>
          <h2>{isEdit ? "Editează cheltuiala" : "Adaugă cheltuiala"}</h2>
          {error && <div className="error-msg" style={{ display: "block" }}>{error}</div>}
          <form onSubmit={handle(isEdit ? editCheltuialaAction : addCheltuialaAction)}>
            {isEdit && <input type="hidden" name="id" value={modal.row!.id} />}
            <div className="form-group">
              <label>Data</label>
              <input type="date" name="data" defaultValue={modal.row?.data ?? today()} required />
            </div>
            <div className="form-group">
              <label>Categorie</label>
              <select name="categorie" defaultValue={modal.row?.categorie ?? ""} required>
                <option value="" disabled>—</option>
                {catChelt.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Sumă (lei)</label>
              <input type="number" name="suma" step="0.01" min="0.01" defaultValue={modal.row?.suma ?? ""} required />
            </div>
            <div className="form-group">
              <label>Detalii</label>
              <input type="text" name="detalii" defaultValue={modal.row?.detalii ?? ""} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Anulează</button>
              <button type="submit" className="btn btn-red" disabled={pending}>{pending ? "..." : "Salvează"}</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // portofel
  const isEdit = modal.row != null;
  return (
    <div className="modal-overlay visible" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{isEdit ? "Editează snapshot portofel" : "Actualizează portofelul"}</h2>
        {error && <div className="error-msg" style={{ display: "block" }}>{error}</div>}
        <form onSubmit={handle(isEdit ? editPortofelAction : addPortofelAction)}>
          {isEdit && <input type="hidden" name="id" value={modal.row!.id} />}
          <div className="form-group">
            <label>Data</label>
            <input type="date" name="data" defaultValue={modal.row?.data ?? today()} required />
          </div>
          <div className="portofel-form-grid">
            <div className="form-group">
              <label>Cash 💵 (lei)</label>
              <input type="number" name="cash" step="0.01" min="0" defaultValue={modal.row?.cash ?? 0} />
            </div>
            <div className="form-group">
              <label>ING 🏦 (lei)</label>
              <input type="number" name="ing" step="0.01" min="0" defaultValue={modal.row?.ing ?? 0} />
            </div>
            <div className="form-group">
              <label>Revolut 💳 (lei)</label>
              <input type="number" name="revolut" step="0.01" min="0" defaultValue={modal.row?.revolut ?? 0} />
            </div>
            <div className="form-group">
              <label>Trading212 📈 (lei)</label>
              <input type="number" name="trading212" step="0.01" min="0" defaultValue={modal.row?.trading212 ?? 0} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Anulează</button>
            <button type="submit" className="btn btn-blue" disabled={pending}>{pending ? "..." : "Salvează"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

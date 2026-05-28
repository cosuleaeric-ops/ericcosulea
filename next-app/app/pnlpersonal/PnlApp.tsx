"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  addCategorieCheltuialaAction,
  addCategorieVenitAction,
  addCheltuialaAction,
  addPortofelAction,
  addVenitAction,
  deleteCheltuialaAction,
  deletePortofelAction,
  deleteVenitAction,
  editCheltuialaAction,
  editPortofelAction,
  editVenitAction,
} from "./actions";
import type { Cheltuiala, PnlDataInput, Portofel, Venit } from "./types";
import { usePnlData } from "./usePnlData";
import { dayShift, fmt, fmtDate, fmtRon, periodLabel, today } from "./utils";

const RankingChart = dynamic(() => import("./RankingChart"), { ssr: false });

const CAT_COLORS = [
  "#4A90D9", "#E8704A", "#2A7D4F", "#C1444A", "#7B5EA7",
  "#D4A017", "#E8A87C", "#85C1E9", "#A9DFBF", "#F1948A",
  "#B8860B", "#5DADE2", "#A569BD", "#45B39D", "#EC7063",
  "#F0B27A", "#82E0AA", "#AED6F1", "#F9E79F", "#D2B4DE",
  "#A3E4D7", "#FAD7A0", "#FDFEFE", "#D5D8DC", "#1A5276",
];

const LAST_DATE_KEY = "pnlpersonal_last_date";

type Props = PnlDataInput & {
  todayKey: string;
  isMonday: boolean;
  catVenit: string[];
  catChelt: string[];
  latestPortofel: Portofel | null;
};

type Tab = "toate" | "venituri" | "cheltuieli";

type ModalState =
  | { kind: "none" }
  | { kind: "venit"; row: Venit | null }
  | { kind: "cheltuiala"; row: Cheltuiala | null }
  | { kind: "portofel"; row: Portofel | null; prefill?: Portofel | null };

export default function PnlApp(props: Props) {
  const router = useRouter();
  const {
    period, setPeriod, periodIsYear, periods,
    prevPeriodValue, nextPeriodValue,
    venituri, cheltuieli,
    filteredVenituri, filteredCheltuieli, filteredPortofel,
    totalVenituri, totalCheltuieli, profitNet, marja,
    days, medieZilnica, prevMonthLabel,
    diffTxt, card4ValueClass, card4SubText,
    topCategorii, lastCheltuialaDate, lastEntryInfo,
  } = usePnlData(props);

  const [tab, setTab] = useState<Tab>("toate");
  const [filterCategorie, setFilterCategorie] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "none" });
  const [hideSums, setHideSums] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const [rankingExpanded, setRankingExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.body.classList.toggle("hide-sums", hideSums);
    return () => document.body.classList.remove("hide-sums");
  }, [hideSums]);

  useEffect(() => {
    if (localStorage.getItem("pnl_hide_sums") === "1") setHideSums(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("pnl_hide_sums", hideSums ? "1" : "0");
  }, [hideSums]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setModal({ kind: "none" }); return; }
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "c") setModal({ kind: "cheltuiala", row: null });
      if (e.key === "v") setModal({ kind: "venit", row: null });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const txList = useMemo(() => {
    const all: Array<{ kind: "venit" | "cheltuiala"; date: string; categorie: string; detalii: string; suma: number; id: number }> = [];
    if (tab === "toate" || tab === "venituri") {
      for (const v of filteredVenituri) {
        all.push({ kind: "venit", date: v.data, categorie: v.descriere, detalii: "", suma: v.suma, id: v.id });
      }
    }
    if (tab === "toate" || tab === "cheltuieli") {
      for (const c of filteredCheltuieli) {
        if (tab === "cheltuieli" && filterCategorie && c.categorie !== filterCategorie) continue;
        all.push({ kind: "cheltuiala", date: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma, id: c.id });
      }
    }
    all.sort((a, b) => (b.date.localeCompare(a.date)) || (b.id - a.id));
    return all;
  }, [filteredVenituri, filteredCheltuieli, tab, filterCategorie]);

  const cheltuieliCategoriiSorted = useMemo(() => {
    const totals = new Map<string, number>();
    for (const c of filteredCheltuieli) totals.set(c.categorie, (totals.get(c.categorie) ?? 0) + c.suma);
    return Array.from(totals, ([cat, suma]) => ({ cat, suma })).sort((a, b) => b.suma - a.suma).map((x) => x.cat);
  }, [filteredCheltuieli]);

  const latestTotalLichid = props.latestPortofel
    ? props.latestPortofel.cash + props.latestPortofel.ing + props.latestPortofel.revolut
    : 0;

  const onDataChange = () => router.refresh();

  const onDelete = (kind: "venit" | "cheltuiala" | "portofel", id: number, label: string) => {
    if (!confirm(label)) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startTransition(async () => {
      if (kind === "venit") await deleteVenitAction(fd);
      else if (kind === "cheltuiala") await deleteCheltuialaAction(fd);
      else await deletePortofelAction(fd);
      onDataChange();
    });
  };

  const portofelPrefill = (): Portofel | null => {
    if (!props.latestPortofel) return null;
    return { ...props.latestPortofel, id: 0, data: props.todayKey };
  };

  const headerLabel = periodLabel(period);

  return (
    <>
      <header className="app-header">
        <h1>P&amp;L — Personal</h1>
        <div className="header-controls">
          <button
            type="button"
            className="month-nav-btn"
            title="Luna anterioară"
            disabled={!prevPeriodValue}
            onClick={() => prevPeriodValue && setPeriod(prevPeriodValue)}
          >‹</button>
          <button
            type="button"
            className="month-nav-btn"
            title="Luna următoare"
            disabled={!nextPeriodValue}
            onClick={() => nextPeriodValue && setPeriod(nextPeriodValue)}
          >›</button>
          <select
            className="year-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option
                key={p.value}
                value={p.value}
                style={!p.isYear ? { color: "var(--muted)" } : undefined}
              >{p.isYear ? p.label : `  ${p.label}`}</option>
            ))}
          </select>
          <button
            type="button"
            className="logout-link"
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: "inherit" }}
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              window.location.href = "/admin/login";
            }}
          >Ieși</button>
        </div>
      </header>

      {props.isMonday && !bannerClosed && props.latestPortofel?.data !== props.todayKey && (
        <div className="monday-banner visible">
          <span className="banner-icon">🔔</span>
          <span className="banner-text">E luni! Nu uita să actualizezi valorile din portofel.</span>
          <button className="banner-btn" onClick={() => setModal({ kind: "portofel", row: null, prefill: portofelPrefill() })}>Actualizează portofelul</button>
          <button className="banner-close" onClick={() => setBannerClosed(true)}>×</button>
        </div>
      )}

      <main className="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <a href="/admin" style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>← Dashboard</a>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setHideSums((v) => !v)}
              title="Ascunde/Arată sumele"
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 14, lineHeight: 1, color: "var(--muted)" }}
            >{hideSums ? "🙈" : "👁"}</button>
            {lastCheltuialaDate && lastEntryInfo && (
              <span className={`last-entry-badge ${lastEntryInfo.stale ? "stale" : ""}`}>
                Ultima cheltuială: {fmtDate(lastCheltuialaDate)} ({lastEntryInfo.when})
              </span>
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
            <div className={`portofel-history-header ${showHistory ? "open" : ""}`} onClick={() => setShowHistory((v) => !v)}>
              <span>Detalii &amp; Istoric</span>
              <span className="toggle-icon">▼</span>
            </div>
            {showHistory && (
              <div className="portofel-history-body open" style={{ display: "block" }}>
                <div className="portofel-grid portofel-grid-inner">
                  <div className="stat-card accent-green"><div className="label">Cash 💵</div><div className="value green">{props.latestPortofel ? fmtRon(props.latestPortofel.cash) : "0,00 lei"}</div><div className="sub">portofel fizic</div></div>
                  <div className="stat-card accent-orange"><div className="label">ING 🏦</div><div className="value" style={{ color: "#E8704A" }}>{props.latestPortofel ? fmtRon(props.latestPortofel.ing) : "0,00 lei"}</div><div className="sub">cont curent</div></div>
                  <div className="stat-card accent-blue"><div className="label">Revolut 💳</div><div className="value blue">{props.latestPortofel ? fmtRon(props.latestPortofel.revolut) : "0,00 lei"}</div><div className="sub">cont digital</div></div>
                  <div className="stat-card accent-gold"><div className="label">Total Lichid 💰</div><div className="value gold">{props.latestPortofel ? fmtRon(latestTotalLichid) : "0,00 lei"}</div><div className="sub">cash + ing + revolut</div></div>
                  <div className="stat-card accent-purple"><div className="label">Trading212 📈</div><div className="value purple">{props.latestPortofel ? fmtRon(props.latestPortofel.trading212) : "0,00 lei"}</div><div className="sub">investiții</div></div>
                </div>
                <div className="portofel-meta portofel-meta-inner">
                  <span>{props.latestPortofel ? `Actualizat: ${fmtDate(props.latestPortofel.data)}` : "Nicio înregistrare"}</span>
                  {props.latestPortofel && <>
                    <span>·</span>
                    <a className="update-link" onClick={() => setModal({ kind: "portofel", row: props.latestPortofel })} style={{ cursor: "pointer" }}>Editează ultima intrare</a>
                  </>}
                  <span>·</span>
                  <button className="btn btn-blue btn-sm" onClick={() => setModal({ kind: "portofel", row: null, prefill: portofelPrefill() })}>+ Actualizează</button>
                </div>
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
                    {filteredPortofel.length === 0 ? (
                      <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}>Nicio înregistrare</div></td></tr>
                    ) : filteredPortofel.map((p) => (
                      <tr key={p.id}>
                        <td>{fmtDate(p.data)}</td>
                        <td className="right">{fmt(p.cash)}</td>
                        <td className="right">{fmt(p.ing)}</td>
                        <td className="right">{fmt(p.revolut)}</td>
                        <td className="right total-cell">{fmt(p.cash + p.ing + p.revolut)}</td>
                        <td className="right invested">{fmt(p.trading212)}</td>
                        <td>
                          <div className="actions-cell">
                            <button className="icon-btn" title="Editează" onClick={() => setModal({ kind: "portofel", row: p })}>✎</button>
                            <button className="icon-btn danger" title="Șterge" onClick={() => onDelete("portofel", p.id, "Ștergi această înregistrare?")} disabled={pending}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <hr className="section-divider" />

        <div className="stats-grid">
          <div className="stat-card accent-green">
            <div className="label">Venituri totale</div>
            <div className="value green">{fmtRon(totalVenituri)}</div>
            <div className="sub"></div>
          </div>
          <div className="stat-card accent-red">
            <div className="label">Cheltuieli totale</div>
            <div className="value red">{fmtRon(totalCheltuieli)}</div>
            <div className="sub"></div>
          </div>
          {periodIsYear ? (
            <>
              <div className="stat-card accent-gold">
                <div className="label">Profit net</div>
                <div className={`value ${profitNet >= 0 ? "green" : "red"}`}>{`${profitNet >= 0 ? "+" : ""}${fmt(profitNet)} lei`}</div>
                <div className="sub"></div>
              </div>
              <div className="stat-card accent-blue">
                <div className="label">Marjă profit</div>
                <div className={`value ${marja >= 0 ? "green" : "red"}`}>{`${marja >= 0 ? "+" : ""}${marja}%`}</div>
                <div className="sub">din venituri</div>
              </div>
            </>
          ) : (
            <>
              <div className="stat-card accent-gold">
                <div className="label">Medie zilnică</div>
                <div className="value gold">{fmtRon(medieZilnica)}</div>
                <div className="sub">din {days} zile</div>
              </div>
              <div className="stat-card accent-purple">
                <div className="label">Față de {prevMonthLabel}</div>
                <div className={`value ${card4ValueClass}`}>{diffTxt}</div>
                <div className="sub">{card4SubText}</div>
              </div>
            </>
          )}
        </div>

        {topCategorii.length > 0 && (
          <div className="chart-card cumulative-card">
            <h3>Top categorii</h3>
            <div className="ranking-wrap" style={{ height: Math.max(160, (rankingExpanded ? topCategorii.length : Math.min(5, topCategorii.length)) * 38) }}>
              <RankingChart
                data={rankingExpanded ? topCategorii : topCategorii.slice(0, 5)}
                colors={CAT_COLORS}
              />
            </div>
            {topCategorii.length > 5 && (
              <button className="ranking-toggle" onClick={() => setRankingExpanded((v) => !v)}>
                {rankingExpanded ? "▲ Mai puține" : "▼ Vezi toate"}
              </button>
            )}
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

          {tab === "cheltuieli" && cheltuieliCategoriiSorted.length > 0 && (
            <div className="cat-filter-bar">
              {cheltuieliCategoriiSorted.map((c) => (
                <button
                  key={c}
                  className={`cat-pill ${filterCategorie === c ? "active" : ""}`}
                  onClick={() => setFilterCategorie(filterCategorie === c ? null : c)}
                >{c}</button>
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
                    <tr><td colSpan={4}><div className="empty-state">Nicio tranzacție în {headerLabel}</div></td></tr>
                  ) : txList.map((t) => (
                    <tr key={`${t.kind}-${t.id}`}>
                      <td>{fmtDate(t.date)}</td>
                      <td>
                        {tab === "toate" && (
                          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: t.kind === "venit" ? "#2A7D4F" : "#C1444A", marginRight: 7, verticalAlign: "middle" }} />
                        )}
                        {t.categorie}
                        {t.detalii && <div className="tx-detalii">{t.detalii}</div>}
                      </td>
                      <td className={`right ${t.kind === "venit" ? "suma-green" : "suma-red"}`}>
                        {t.kind === "venit" ? "+" : "−"} {fmt(t.suma)}
                      </td>
                      <td>
                        <div className="actions-cell">
                          <button className="icon-btn" title="Editează" onClick={() => {
                            if (t.kind === "venit") {
                              const row = venituri.find((v) => v.id === t.id);
                              if (row) setModal({ kind: "venit", row });
                            } else {
                              const row = cheltuieli.find((c) => c.id === t.id);
                              if (row) setModal({ kind: "cheltuiala", row });
                            }
                          }}>✎</button>
                          <button className="icon-btn danger" title="Șterge" disabled={pending} onClick={() => onDelete(t.kind, t.id, "Ștergi această tranzacție?")}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {modal.kind === "venit" && (
        <VenitModal
          row={modal.row}
          catVenit={props.catVenit}
          onClose={() => setModal({ kind: "none" })}
          onSaved={(savedDate) => {
            if (!modal.row && savedDate) localStorage.setItem(LAST_DATE_KEY, savedDate);
            setModal({ kind: "none" });
            onDataChange();
          }}
        />
      )}
      {modal.kind === "cheltuiala" && (
        <CheltuialaModal
          row={modal.row}
          catChelt={props.catChelt}
          onClose={() => setModal({ kind: "none" })}
          onSavedEdit={() => { setModal({ kind: "none" }); onDataChange(); }}
          onSavedAdd={(savedDate) => {
            if (savedDate) localStorage.setItem(LAST_DATE_KEY, savedDate);
            onDataChange();
          }}
        />
      )}
      {modal.kind === "portofel" && (
        <PortofelModal
          row={modal.row}
          prefill={modal.prefill ?? null}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => { setModal({ kind: "none" }); setBannerClosed(true); onDataChange(); }}
        />
      )}
    </>
  );
}

function getInitialAddDate(): string {
  if (typeof window === "undefined") return today();
  return localStorage.getItem(LAST_DATE_KEY) || today();
}

function VenitModal({
  row, catVenit, onClose, onSaved,
}: {
  row: Venit | null;
  catVenit: string[];
  onClose: () => void;
  onSaved: (savedDate: string | null) => void;
}) {
  const isEdit = row != null;
  const [data, setData] = useState(row?.data ?? getInitialAddDate());
  const [cat, setCat] = useState(row?.descriere ?? (catVenit[0] ?? "__new__"));
  const [catNoua, setCatNoua] = useState("");
  const [suma, setSuma] = useState(row ? String(row.suma) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const sumaRef = useRef<HTMLInputElement>(null);
  const catNouaRef = useRef<HTMLInputElement>(null);

  useEffect(() => { sumaRef.current?.focus(); }, []);
  useEffect(() => { if (cat === "__new__") catNouaRef.current?.focus(); }, [cat]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    let descriere = cat;
    if (cat === "__new__") {
      const nume = catNoua.trim();
      if (!nume) { setError("Selectează sau creează o categorie."); return; }
      setCreating(true);
      const fd = new FormData(); fd.set("nume", nume);
      const res = await addCategorieVenitAction(undefined, fd);
      setCreating(false);
      if (res?.error) { setError(res.error); return; }
      descriere = nume;
    }
    const fd = new FormData();
    if (isEdit && row) fd.set("id", String(row.id));
    fd.set("data", data);
    fd.set("descriere", descriere);
    fd.set("suma", suma);
    startTransition(async () => {
      const res = await (isEdit ? editVenitAction : addVenitAction)(undefined, fd);
      if (res?.error) setError(res.error);
      else onSaved(data);
    });
  };

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>{isEdit ? "Editează venit" : "Adaugă venit"}</h2>
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
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {catVenit.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ Categorie nouă...</option>
            </select>
            {cat === "__new__" && (
              <input
                ref={catNouaRef}
                type="text"
                placeholder="Nume categorie nouă"
                value={catNoua}
                onChange={(e) => setCatNoua(e.target.value)}
                style={{ marginTop: 8, width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 14, background: "var(--bg)" }}
              />
            )}
          </div>
          <div className="form-group">
            <label>Sumă (lei)</label>
            <input ref={sumaRef} type="number" step="0.01" min="0.01" value={suma} onChange={(e) => setSuma(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Anulează</button>
            <button type="submit" className="btn btn-green" disabled={pending || creating}>{pending || creating ? "..." : (isEdit ? "Salvează" : "Adaugă")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CheltuialaModal({
  row, catChelt, onClose, onSavedEdit, onSavedAdd,
}: {
  row: Cheltuiala | null;
  catChelt: string[];
  onClose: () => void;
  onSavedEdit: () => void;
  onSavedAdd: (savedDate: string) => void;
}) {
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

function PortofelModal({
  row, prefill, onClose, onSaved,
}: {
  row: Portofel | null;
  prefill: Portofel | null;
  onClose: () => void;
  onSaved: () => void;
}) {
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

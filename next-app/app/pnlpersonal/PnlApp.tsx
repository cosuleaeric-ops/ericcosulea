"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const RankingChart = dynamic(() => import("./RankingChart"), { ssr: false });

const CAT_COLORS = [
  "#4A90D9", "#E8704A", "#2A7D4F", "#C1444A", "#7B5EA7",
  "#D4A017", "#E8A87C", "#85C1E9", "#A9DFBF", "#F1948A",
  "#B8860B", "#5DADE2", "#A569BD", "#45B39D", "#EC7063",
  "#F0B27A", "#82E0AA", "#AED6F1", "#F9E79F", "#D2B4DE",
  "#A3E4D7", "#FAD7A0", "#FDFEFE", "#D5D8DC", "#1A5276",
];

const LAST_DATE_KEY = "pnlpersonal_last_date";

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

type Venit = { id: number; data: string; descriere: string; suma: number };
type Cheltuiala = { id: number; data: string; categorie: string; detalii: string; suma: number };
type Portofel = { id: number; data: string; cash: number; ing: number; revolut: number; trading212: number };

type PeriodOpt = { value: string; label: string; isYear: boolean };

type Props = {
  period: string;
  periodIsYear: boolean;
  monthLabel: string;
  prevLabel: string;
  periods: PeriodOpt[];
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
const dayShift = (yyyymmdd: string, delta: number) => {
  const d = new Date(yyyymmdd || today());
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
};

type Tab = "toate" | "venituri" | "cheltuieli";

type ModalState =
  | { kind: "none" }
  | { kind: "venit"; row: Venit | null }
  | { kind: "cheltuiala"; row: Cheltuiala | null }
  | { kind: "portofel"; row: Portofel | null; prefill?: Portofel | null };

export default function PnlApp(props: Props) {
  const router = useRouter();
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

  // Keyboard shortcuts: c = cheltuiala, v = venit, Esc = close
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

  const totalVenituri = props.venituri.reduce((s, v) => s + v.suma, 0);
  const totalCheltuieli = props.cheltuieli.reduce((s, c) => s + c.suma, 0);
  const profitNet = totalVenituri - totalCheltuieli;
  const marja = totalVenituri > 0 ? Math.round((profitNet / totalVenituri) * 100) : 0;

  const medieZilnica = props.daysInMonth > 0 ? totalCheltuieli / props.daysInMonth : 0;
  const prevC = props.prevMonthTotalCheltuieli;
  const diff = prevC > 0 ? ((totalCheltuieli - prevC) / prevC) * 100 : null;
  const diffTxt = diff === null ? "—" : `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
  const card4ValueClass = diff === null ? "" : (diff <= 0 ? "green" : "red");
  const card4SubText = prevC > 0 ? `${fmt(prevC)} lei atunci` : "fără date";

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

  const txList = useMemo(() => {
    const all: Array<{ kind: "venit" | "cheltuiala"; date: string; categorie: string; detalii: string; suma: number; id: number }> = [];
    if (tab === "toate" || tab === "venituri") {
      for (const v of props.venituri) {
        all.push({ kind: "venit", date: v.data, categorie: v.descriere, detalii: "", suma: v.suma, id: v.id });
      }
    }
    if (tab === "toate" || tab === "cheltuieli") {
      for (const c of props.cheltuieli) {
        if (tab === "cheltuieli" && filterCategorie && c.categorie !== filterCategorie) continue;
        all.push({ kind: "cheltuiala", date: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma, id: c.id });
      }
    }
    all.sort((a, b) => (b.date.localeCompare(a.date)) || (b.id - a.id));
    return all;
  }, [props.venituri, props.cheltuieli, tab, filterCategorie]);

  const cheltuieliCategoriiSorted = useMemo(() => {
    const totals = new Map<string, number>();
    for (const c of props.cheltuieli) totals.set(c.categorie, (totals.get(c.categorie) ?? 0) + c.suma);
    return Array.from(totals, ([cat, suma]) => ({ cat, suma })).sort((a, b) => b.suma - a.suma).map((x) => x.cat);
  }, [props.cheltuieli]);

  const lastEntryInfo = useMemo(() => {
    if (!props.lastEntryDate) return null;
    const [y, m, d] = props.lastEntryDate.split("-").map(Number);
    const entryDt = new Date(y, m - 1, d);
    const todayDt = new Date(); todayDt.setHours(0, 0, 0, 0);
    const diffZ = Math.round((todayDt.getTime() - entryDt.getTime()) / 86400000);
    const when = diffZ === 0 ? "azi" : diffZ === 1 ? "ieri" : `acum ${diffZ} zile`;
    return { when, stale: diffZ >= 3 };
  }, [props.lastEntryDate]);

  // Month-only periods for arrow navigation
  const monthOnlyPeriods = useMemo(() => props.periods.filter((p) => !p.isYear), [props.periods]);
  const navIdx = monthOnlyPeriods.findIndex((p) => p.value === props.period);
  const prevPeriodValue = navIdx >= 0 && navIdx < monthOnlyPeriods.length - 1 ? monthOnlyPeriods[navIdx + 1].value : null;
  const nextPeriodValue = navIdx > 0 ? monthOnlyPeriods[navIdx - 1].value : null;

  const goPeriod = (m: string) => {
    router.push(`/pnlpersonal?m=${m}`);
    router.refresh();
  };

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

  const portofelPrefill = (): Portofel | null => {
    if (!props.latestPortofel) return null;
    return { ...props.latestPortofel, id: 0, data: props.todayKey };
  };

  const headerLabel = props.periodIsYear ? props.period : props.monthLabel;

  return (
    <>
      <header className="app-header">
        <h1>P&amp;L — Personal</h1>
        <div className="header-controls">
          {prevPeriodValue ? (
            <Link href={`/pnlpersonal?m=${prevPeriodValue}`} className="month-nav-btn" title="Luna anterioară" prefetch>‹</Link>
          ) : (
            <button className="month-nav-btn" disabled title="Luna anterioară">‹</button>
          )}
          {nextPeriodValue ? (
            <Link href={`/pnlpersonal?m=${nextPeriodValue}`} className="month-nav-btn" title="Luna următoare" prefetch>›</Link>
          ) : (
            <button className="month-nav-btn" disabled title="Luna următoare">›</button>
          )}
          <select
            className="year-select"
            value={props.period}
            onChange={(e) => goPeriod(e.target.value)}
          >
            {props.periods.map((p) => (
              <option
                key={p.value}
                value={p.value}
                style={!p.isYear ? { color: "var(--muted)" } : undefined}
              >{p.isYear ? p.label : `  ${p.label}`}</option>
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

      {props.isMonday && !bannerClosed && (
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
            {props.lastEntryDate && lastEntryInfo && (
              <span className={`last-entry-badge ${lastEntryInfo.stale ? "stale" : ""}`}>
                Ultima cheltuială: {fmtDate(props.lastEntryDate)} ({lastEntryInfo.when})
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
                    {props.allPortofel.length === 0 ? (
                      <tr><td colSpan={7}><div className="empty-state" style={{ padding: 24 }}>Nicio înregistrare</div></td></tr>
                    ) : props.allPortofel.map((p) => (
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
          {props.periodIsYear ? (
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
                <div className="sub">din {props.daysInMonth} zile</div>
              </div>
              <div className="stat-card accent-purple">
                <div className="label">Față de {props.prevLabel}</div>
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
                              const row = props.venituri.find((v) => v.id === t.id);
                              if (row) setModal({ kind: "venit", row });
                            } else {
                              const row = props.cheltuieli.find((c) => c.id === t.id);
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
            router.refresh();
          }}
        />
      )}
      {modal.kind === "cheltuiala" && (
        <CheltuialaModal
          row={modal.row}
          catChelt={props.catChelt}
          onClose={() => setModal({ kind: "none" })}
          onSavedEdit={() => { setModal({ kind: "none" }); router.refresh(); }}
          onSavedAdd={(savedDate) => {
            if (savedDate) localStorage.setItem(LAST_DATE_KEY, savedDate);
            router.refresh();
          }}
        />
      )}
      {modal.kind === "portofel" && (
        <PortofelModal
          row={modal.row}
          prefill={modal.prefill ?? null}
          onClose={() => setModal({ kind: "none" })}
          onSaved={() => { setModal({ kind: "none" }); router.refresh(); }}
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
  const [cat, setCat] = useState(row?.categorie ?? (catChelt[0] ?? "__new__"));
  const [catNoua, setCatNoua] = useState("");
  const [suma, setSuma] = useState(row ? String(row.suma) : "");
  const [detalii, setDetalii] = useState(row?.detalii ?? "");
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
    let categorie = cat;
    if (cat === "__new__") {
      const nume = catNoua.trim();
      if (!nume) { setError("Selectează sau creează o categorie."); return; }
      setCreating(true);
      const fd = new FormData(); fd.set("nume", nume);
      const res = await addCategorieCheltuialaAction(undefined, fd);
      setCreating(false);
      if (res?.error) { setError(res.error); return; }
      categorie = nume;
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
        // Rapid entry: keep modal open, reset suma + detalii, focus suma
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
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              {catChelt.map((c) => <option key={c} value={c}>{c}</option>)}
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

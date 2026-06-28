"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowUpDown } from "lucide-react";
import { formatNumber } from "@/lib/analytics/format";
import type { KeywordRow } from "./KeywordTab";

type Col = "query" | "clicks" | "impressions" | "ctr" | "position";
type Sort = { col: Col; dir: "asc" | "desc" };

export function KeywordModal({
  rows,
  path,
  onClose,
}: {
  rows: KeywordRow[];
  path?: string;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>({ col: "clicks", dir: "desc" });

  const view = useMemo(() => {
    const filtered = q
      ? rows.filter((r) => r.query.toLowerCase().includes(q.toLowerCase()))
      : rows;
    return [...filtered].sort((a, b) => {
      const d =
        sort.col === "query" ? a.query.localeCompare(b.query) : a[sort.col] - b[sort.col];
      return sort.dir === "asc" ? d : -d;
    });
  }, [rows, q, sort]);

  function toggle(col: Col) {
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "query" ? "asc" : "desc" },
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="dfa-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        onClick={onClose}
      >
        <motion.div
          className="dfa-modal dfa-modal-wide"
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dfa-modal-head">
            <h3>Keywords{path ? ` · ${path}` : ""}</h3>
            <button className="dfa-btn dfa-btn-icon" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="dfa-modal-search">
            <Search size={15} className="dfa-faint" />
            <input autoFocus placeholder="Search keyword…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="dfa-modal-table">
            <div className="dfa-kw-head">
              <button className="dfa-th" onClick={() => toggle("query")}>
                Keyword <ArrowUpDown size={12} />
              </button>
              <button className="dfa-th dfa-th-num" onClick={() => toggle("clicks")}>
                Clicks <ArrowUpDown size={12} />
              </button>
              <button className="dfa-th dfa-th-num" onClick={() => toggle("impressions")}>
                Impr. <ArrowUpDown size={12} />
              </button>
              <button className="dfa-th dfa-th-num" onClick={() => toggle("ctr")}>
                CTR <ArrowUpDown size={12} />
              </button>
              <button className="dfa-th dfa-th-num" onClick={() => toggle("position")}>
                Pos. <ArrowUpDown size={12} />
              </button>
            </div>
            <div className="dfa-modal-rows">
              {view.map((r) => (
                <div key={r.query} className="dfa-kw-row">
                  <span className="dfa-modal-name">{r.query}</span>
                  <span className="dfa-th-num">{formatNumber(r.clicks)}</span>
                  <span className="dfa-th-num">{formatNumber(r.impressions)}</span>
                  <span className="dfa-th-num">{(r.ctr * 100).toFixed(1)}%</span>
                  <span className="dfa-th-num">{r.position.toFixed(1)}</span>
                </div>
              ))}
              {view.length === 0 && <div className="dfa-panel-empty">Niciun rezultat.</div>}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

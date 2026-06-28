"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowUpDown } from "lucide-react";
import type { BreakdownRow, Filters } from "@/lib/analytics/queries";
import { formatNumber } from "@/lib/analytics/format";
import type { TabDef } from "./BreakdownPanel";

type Sort = { col: "label" | "value"; dir: "asc" | "desc" };

export function BreakdownModal({
  tab,
  rows,
  onClose,
  onFilter,
}: {
  tab: TabDef | null;
  rows: BreakdownRow[];
  onClose: () => void;
  onFilter: (key: keyof Filters, value: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>({ col: "value", dir: "desc" });

  const total = useMemo(() => rows.reduce((s, r) => s + r.value, 0), [rows]);

  const view = useMemo(() => {
    const labeled = rows.map((r) => ({
      ...r,
      label: tab?.renderRow ? tab.renderRow(r.key).label : r.key,
      icon: tab?.renderRow ? tab.renderRow(r.key).icon : null,
    }));
    const filtered = q
      ? labeled.filter((r) => r.label.toLowerCase().includes(q.toLowerCase()))
      : labeled;
    const sorted = [...filtered].sort((a, b) => {
      const d =
        sort.col === "value"
          ? a.value - b.value
          : a.label.localeCompare(b.label);
      return sort.dir === "asc" ? d : -d;
    });
    return sorted;
  }, [rows, q, sort, tab]);

  function toggle(col: "label" | "value") {
    setSort((s) =>
      s.col === col
        ? { col, dir: s.dir === "asc" ? "desc" : "asc" }
        : { col, dir: col === "value" ? "desc" : "asc" },
    );
  }

  return (
    <AnimatePresence>
      {tab && (
        <motion.div
          className="dfa-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
        >
          <motion.div
            className="dfa-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dfa-modal-head">
              <h3>{tab.label}</h3>
              <button className="dfa-btn dfa-btn-icon" onClick={onClose}>
                <X size={16} />
              </button>
            </div>

            <div className="dfa-modal-search">
              <Search size={15} className="dfa-faint" />
              <input
                autoFocus
                placeholder="Search…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="dfa-modal-table">
              <div className="dfa-modal-thead">
                <button className="dfa-th dfa-th-name" onClick={() => toggle("label")}>
                  Name <ArrowUpDown size={12} />
                </button>
                <button className="dfa-th dfa-th-num" onClick={() => toggle("value")}>
                  Visitors <ArrowUpDown size={12} />
                </button>
                <span className="dfa-th dfa-th-num">%</span>
              </div>
              <div className="dfa-modal-rows">
                {view.map((r) => {
                  const pct = total ? (r.value / total) * 100 : 0;
                  const clickable = !!tab.filterKey;
                  return (
                    <div
                      key={r.key}
                      className={`dfa-modal-row${clickable ? " is-clickable" : ""}`}
                      onClick={() => {
                        if (clickable) {
                          onFilter(tab.filterKey!, r.key);
                          onClose();
                        }
                      }}
                    >
                      <span className="dfa-modal-name">
                        {r.icon && <span className="dfa-row-ico">{r.icon}</span>}
                        {r.label}
                      </span>
                      <span className="dfa-th-num">{formatNumber(r.value)}</span>
                      <span className="dfa-th-num dfa-muted">{pct.toFixed(1)}%</span>
                    </div>
                  );
                })}
                {view.length === 0 && (
                  <div className="dfa-panel-empty">Niciun rezultat.</div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

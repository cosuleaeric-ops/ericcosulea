"use client";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Breakdowns, BreakdownRow, Filters } from "@/lib/analytics/queries";
import { formatNumber } from "@/lib/analytics/format";

export type TabDef = {
  key: string;
  label: string;
  dim?: keyof Breakdowns;
  filterKey?: keyof Filters;
  unit?: string;
  renderRow?: (key: string) => { icon?: ReactNode; label: string };
  placeholder?: ReactNode;
};

const ROWS_SHOWN = 7;

export function BreakdownPanel({
  tabs,
  breakdowns,
  loading,
  defaultTab = 0,
  onFilter,
  onDetails,
}: {
  tabs: TabDef[];
  breakdowns: Breakdowns | null;
  loading: boolean;
  defaultTab?: number;
  onFilter: (key: keyof Filters, value: string) => void;
  onDetails: (tab: TabDef, rows: BreakdownRow[]) => void;
}) {
  const [active, setActive] = useState(defaultTab);
  const tab = tabs[active];
  const rows = tab.dim && breakdowns ? breakdowns[tab.dim] : [];
  const max = rows.length ? rows[0].value : 0;
  const shown = rows.slice(0, ROWS_SHOWN);

  return (
    <div className="dfa-card dfa-panel">
      <div className="dfa-panel-tabs">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            className={`dfa-panel-tab${i === active ? " is-active" : ""}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dfa-panel-body">
        {loading ? (
          <PanelSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              {tab.placeholder ? (
                <div className="dfa-panel-placeholder">{tab.placeholder}</div>
              ) : shown.length === 0 ? (
                <div className="dfa-panel-empty">Fără date în perioada asta.</div>
              ) : (
                shown.map((row) => {
                  const rendered = tab.renderRow
                    ? tab.renderRow(row.key)
                    : { label: row.key };
                  const pct = max ? (row.value / max) * 100 : 0;
                  const clickable = !!tab.filterKey;
                  return (
                    <div
                      key={row.key}
                      className={`dfa-row${clickable ? " is-clickable" : ""}`}
                      onClick={() =>
                        clickable && onFilter(tab.filterKey!, row.key)
                      }
                      title={clickable ? `Filtrează: ${rendered.label}` : undefined}
                    >
                      <motion.span
                        className="dfa-row-bar"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: "easeOut" }}
                      />
                      <span className="dfa-row-main">
                        {rendered.icon && (
                          <span className="dfa-row-ico">{rendered.icon}</span>
                        )}
                        <span className="dfa-row-label">{rendered.label}</span>
                      </span>
                      <span className="dfa-row-value">{formatNumber(row.value)}</span>
                    </div>
                  );
                })
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {!tab.placeholder && rows.length > 0 && (
        <button className="dfa-panel-details" onClick={() => onDetails(tab, rows)}>
          DETAILS
        </button>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="dfa-panel-skel">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="dfa-skeleton" style={{ height: 18, width: `${90 - i * 8}%` }} />
      ))}
    </div>
  );
}

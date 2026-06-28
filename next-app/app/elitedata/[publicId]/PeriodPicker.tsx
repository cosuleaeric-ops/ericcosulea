"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, ChevronDown } from "lucide-react";
import {
  PERIOD_LABELS,
  PERIOD_ORDER,
  PERIOD_SHORTCUTS,
  formatCurrentTime,
  type PeriodKey,
} from "@/lib/analytics/range";

function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function PeriodPicker({
  period,
  displayLabel,
  tz,
  custom,
  onSelect,
  onCustom,
}: {
  period: PeriodKey;
  displayLabel: string;
  tz: string;
  custom: { from: string; to: string } | null;
  onSelect: (p: PeriodKey) => void;
  onCustom: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState(custom?.from ?? todayStr(-6));
  const [to, setTo] = useState(custom?.to ?? todayStr(0));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setShowCustom(false);
  }, [open]);

  return (
    <div className="dfa-dd" ref={ref}>
      <button
        type="button"
        className="dfa-period-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        {period === "now" && <span className="dfa-online-dot" />}
        {displayLabel}
        <ChevronDown size={15} className="dfa-faint" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="dfa-dd-menu dfa-period-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <div className="dfa-period-head">Current time: {formatCurrentTime(tz)}</div>

            {!showCustom ? (
              <>
                {PERIOD_ORDER.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`dfa-dd-item dfa-period-item${k === period ? " is-active" : ""}`}
                    onClick={() => {
                      onSelect(k);
                      setOpen(false);
                    }}
                  >
                    {k === "now" && <span className="dfa-online-dot" />}
                    <span className="dfa-dd-label">{PERIOD_LABELS[k]}</span>
                    {PERIOD_SHORTCUTS[k] && (
                      <kbd className="dfa-kbd">{PERIOD_SHORTCUTS[k]}</kbd>
                    )}
                  </button>
                ))}
                <div className="dfa-period-sep" />
                <button
                  type="button"
                  className={`dfa-dd-item dfa-period-item${period === "custom" ? " is-active" : ""}`}
                  onClick={() => setShowCustom(true)}
                >
                  <span className="dfa-dd-label">Custom</span>
                  <Calendar size={14} className="dfa-faint" />
                </button>
              </>
            ) : (
              <div className="dfa-custom-panel">
                <label>
                  From
                  <input
                    type="date"
                    value={from}
                    max={to}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={to}
                    min={from}
                    max={todayStr(0)}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <div className="dfa-custom-actions">
                  <button className="dfa-btn" onClick={() => setShowCustom(false)}>
                    Back
                  </button>
                  <button
                    className="dfa-btn dfa-btn-primary"
                    onClick={() => {
                      onCustom(from, to);
                      setOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

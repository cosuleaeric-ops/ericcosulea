"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

export type DropdownItem = {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
};

export function Dropdown({
  trigger,
  items,
  value,
  onSelect,
  align = "left",
  width,
}: {
  trigger: ReactNode;
  items: DropdownItem[];
  value?: string;
  onSelect: (key: string) => void;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
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

  return (
    <div className="dfa-dd" ref={ref}>
      <button
        type="button"
        className="dfa-dd-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {trigger}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="dfa-dd-menu"
            style={{ [align]: 0, width } as React.CSSProperties}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                className={`dfa-dd-item${it.key === value ? " is-active" : ""}`}
                onClick={() => {
                  onSelect(it.key);
                  setOpen(false);
                }}
              >
                {it.icon && <span className="dfa-dd-ico">{it.icon}</span>}
                <span className="dfa-dd-label">{it.label}</span>
                {it.key === value && <Check size={14} className="dfa-dd-check" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

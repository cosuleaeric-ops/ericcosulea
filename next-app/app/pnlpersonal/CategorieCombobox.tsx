"use client";

import { useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  cats: string[];
};

/** Normalizeaza la categoria existenta (pastrand scrierea din DB) sau semnaleaza una noua. */
export function resolveCategorie(value: string, cats: string[]): { nume: string; isNew: boolean } | null {
  const nume = value.trim();
  if (!nume) return null;
  const exact = cats.find((c) => c.toLowerCase() === nume.toLowerCase());
  return exact ? { nume: exact, isNew: false } : { nume, isNew: true };
}

export function CategorieCombobox({ value, onChange, cats }: Props) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef(false);

  const typed = value.trim();
  const q = typed.toLowerCase();
  const list = cats.filter((c) => !q || c.toLowerCase().includes(q));
  const isNew = typed !== "" && !cats.some((c) => c.toLowerCase() === q);
  const showBox = open && (list.length > 0 || isNew);

  const pick = (c: string) => { onChange(c); setOpen(false); };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputType = (e.nativeEvent as InputEvent).inputType;
    const isInsert = !inputType || inputType.startsWith("insert");
    const val = e.target.value;
    setOpen(true);
    // Inline autocomplete: completeaza la prima categorie care se potriveste, cu partea adaugata selectata.
    if (isInsert && val.length >= 2) {
      const match = cats.find((c) => c.toLowerCase().startsWith(val.toLowerCase()));
      if (match && match.length > val.length) {
        onChange(match);
        requestAnimationFrame(() => inputRef.current?.setSelectionRange(val.length, match.length));
        return;
      }
    }
    onChange(val);
  };

  return (
    <div className={`categorie-combobox${showBox ? " open" : ""}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoComplete="off"
        placeholder="Scrie sau alege categoria..."
        onChange={onInput}
        onFocus={() => setOpen(true)}
        // Un singur click (cand campul nu era deja focusat) selecteaza tot textul.
        onMouseDown={() => { selectAllRef.current = document.activeElement !== inputRef.current; }}
        onMouseUp={(e) => {
          if (!selectAllRef.current) return;
          e.preventDefault();
          inputRef.current?.select();
          selectAllRef.current = false;
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      <button
        type="button"
        className="cat-combobox-arrow"
        tabIndex={-1}
        aria-label="Arată categoriile"
        onMouseDown={(e) => {
          e.preventDefault();
          if (showBox) { setOpen(false); return; }
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {showBox && (
        <div className="categorie-suggestions">
          {list.map((c) => (
            <button key={c} type="button" onMouseDown={(e) => { e.preventDefault(); pick(c); }}>{c}</button>
          ))}
          {isNew && (
            <button type="button" className="is-new" onMouseDown={(e) => { e.preventDefault(); pick(typed); }}>
              + Categorie nouă: „{typed}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}

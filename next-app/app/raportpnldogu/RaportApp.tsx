"use client";

import { useEffect, useRef, useState } from "react";

type ProviderKey = "wolt" | "glovo" | "bolt";

type ParsedFile = {
  name: string;
  ok: boolean;
  amount?: number;
  error?: string;
};

const CARDS: Array<{ key: ProviderKey; label: string; meta: string; max: number }> = [
  { key: "wolt", label: "Wolt", meta: 'Extragem „Suma facturii"', max: 20 },
  { key: "glovo", label: "Glovo", meta: 'Extragem „Factura totala (TVA inclus)"', max: 8 },
  { key: "bolt", label: "Bolt", meta: 'Extragem „Suma de plată"', max: 20 },
];

function spacedRe(str: string): RegExp {
  const parts = [...str].map((c) => (c === " " ? "\\s+" : c.replace(/[.*+?^${}()|[\]\\]/, "\\$&")));
  return new RegExp(parts.join("\\s*"), "i");
}

function parseRo(n: string): number {
  return parseFloat(String(n).replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
}

function fmtRo(n: number): string {
  return n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " RON";
}

const AMOUNT_RE = /-?\d{1,3}(?:[.\s]\d{3})*\s*,\d{2}/g;

const LABELS: Record<ProviderKey, RegExp> = {
  wolt: spacedRe("Suma facturii"),
  glovo: spacedRe("Factura totala"),
  bolt: new RegExp(spacedRe("SUMA DE PLAT").source + "[ĂăA]", "i"),
};

export default function RaportApp() {
  const pdfjsRef = useRef<typeof import("pdfjs-dist") | null>(null);
  const [state, setState] = useState<Record<ProviderKey, ParsedFile[]>>({ wolt: [], glovo: [], bolt: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const lib = await import("pdfjs-dist");
      lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs";
      pdfjsRef.current = lib;
      setReady(true);
    })();
  }, []);

  const extractLines = async (file: File): Promise<string[]> => {
    const lib = pdfjsRef.current;
    if (!lib) throw new Error("pdf.js not loaded");
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    const lines: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const items = content.items
        .filter((it: any) => it.str && it.str.trim())
        .map((it: any) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
      const groups: Record<string, typeof items> = {};
      for (const it of items) {
        const key = String(Math.round(it.y / 3));
        (groups[key] = groups[key] || []).push(it);
      }
      Object.keys(groups)
        .sort((a, b) => Number(b) - Number(a))
        .forEach((k) => {
          const row = groups[k].sort((a: any, b: any) => a.x - b.x);
          lines.push(row.map((r: any) => r.str).join(" ").replace(/\s+/g, " ").trim());
        });
    }
    return lines;
  };

  const parseFile = async (file: File, type: ProviderKey): Promise<ParsedFile> => {
    try {
      const lines = await extractLines(file);
      const labelRe = LABELS[type];
      for (const line of lines) {
        if (labelRe.test(line)) {
          const nums = line.match(AMOUNT_RE);
          if (nums && nums.length) return { name: file.name, ok: true, amount: parseRo(nums[nums.length - 1]) };
        }
      }
      for (let i = 0; i < lines.length; i++) {
        if (labelRe.test(lines[i])) {
          for (let j = Math.max(0, i - 5); j < Math.min(i + 6, lines.length); j++) {
            if (j === i) continue;
            const nums = lines[j].match(AMOUNT_RE);
            if (nums && nums.length) return { name: file.name, ok: true, amount: parseRo(nums[nums.length - 1]) };
          }
        }
      }
      const flat = lines.join("\n");
      const flatAmtRe = /(\d{1,3}(?:[.\s]\d{3})*\s*,\d{2})/;
      const flatM = flat.match(new RegExp(labelRe.source + "[\\s\\S]{0,400}?" + flatAmtRe.source, "i"))
        || flat.match(new RegExp(flatAmtRe.source + "[\\s\\S]{0,400}?" + labelRe.source, "i"));
      if (flatM) return { name: file.name, ok: true, amount: parseRo(flatM[1]) };
      return { name: file.name, ok: false, error: "nu am găsit suma" };
    } catch {
      return { name: file.name, ok: false, error: "eroare citire PDF" };
    }
  };

  const handleFiles = async (type: ProviderKey, fileList: FileList | File[]) => {
    const max = CARDS.find((c) => c.key === type)!.max;
    const files = Array.from(fileList).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    for (const file of files) {
      setState((prev) => {
        if (prev[type].length >= max) return prev;
        return { ...prev, [type]: [...prev[type], { name: file.name, ok: false, error: "se procesează..." }] };
      });
      const res = await parseFile(file, type);
      setState((prev) => {
        const updated = [...prev[type]];
        const idx = updated.findIndex((f) => f.name === file.name && f.error === "se procesează...");
        if (idx >= 0) updated[idx] = res;
        else updated.push(res);
        return { ...prev, [type]: updated };
      });
    }
  };

  const clearProvider = (type: ProviderKey) => {
    setState((prev) => ({ ...prev, [type]: [] }));
  };

  const grandTotal = Object.values(state)
    .flat()
    .filter((f) => f.ok && f.amount != null)
    .reduce((sum, f) => sum + (f.amount ?? 0), 0);

  return (
    <div className="raport-wrap">
      {!ready && <p className="page-lead">se încarcă pdf.js...</p>}

      {CARDS.map((card) => {
        const list = state[card.key];
        const total = list.filter((f) => f.ok).reduce((s, f) => s + (f.amount ?? 0), 0);
        return (
          <div key={card.key} className="raport-card">
            <div className="raport-card-head">
              <div>
                <div className="raport-card-title">{card.label}</div>
                <div className="raport-card-meta">{card.meta} · {list.length}/{card.max} PDF-uri</div>
              </div>
              <button type="button" className="raport-clear" onClick={() => clearProvider(card.key)}>golește</button>
            </div>
            <label
              className="raport-drop"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("dragover"); }}
              onDragLeave={(e) => e.currentTarget.classList.remove("dragover")}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove("dragover");
                handleFiles(card.key, e.dataTransfer.files);
              }}
            >
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => { if (e.target.files) handleFiles(card.key, e.target.files); }}
                disabled={!ready}
              />
              <div>Trage PDF-uri aici sau <strong>click pentru a selecta</strong></div>
            </label>
            <ul className="raport-files">
              {list.map((f, i) => (
                <li key={i}>
                  <span className="raport-fname">{f.name}</span>
                  <span className={`raport-famount ${f.ok ? "" : "err"}`}>
                    {f.ok ? fmtRo(f.amount ?? 0) : (f.error ?? "eroare")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="raport-total"><span>Total {card.label}</span><span className="raport-amount">{fmtRo(total)}</span></div>
          </div>
        );
      })}

      <div className="raport-grand">
        <span>Total general</span>
        <span className="raport-amount">{fmtRo(grandTotal)}</span>
      </div>
    </div>
  );
}

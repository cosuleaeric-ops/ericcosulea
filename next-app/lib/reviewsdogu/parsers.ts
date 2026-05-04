import * as XLSX from "xlsx";

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const stripped = text.replace(/^﻿/, "");
  const lines = parseLines(stripped);
  if (lines.length === 0) return [];
  const header = lines[0].map((s) => s.trim());
  return lines.slice(1).map((cells) => {
    const row: CsvRow = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").toString();
    });
    return row;
  });
}

function parseLines(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else inQuotes = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; }
      else if (c === "\r") {/* skip */}
      else cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<CsvRow[]> {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return rows.map((r) => {
    const out: CsvRow = {};
    for (const [k, v] of Object.entries(r)) out[k] = v == null ? "" : String(v);
    return out;
  });
}

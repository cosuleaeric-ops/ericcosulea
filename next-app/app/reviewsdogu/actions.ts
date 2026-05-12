"use server";

import { isAuthenticated } from "@/lib/session";
import { parseCsv, parseXlsx } from "@/lib/reviewsdogu/parsers";
import { buildBoltReportFromRows, buildGlovoReportFromRows, type BoltReport, type GlovoReport } from "@/lib/reviewsdogu/report";

export type BoltReportState = { report?: BoltReport; error?: string } | undefined;
export type GlovoReportState = { report?: GlovoReport; error?: string } | undefined;

export async function boltReportAction(_prev: BoltReportState, formData: FormData): Promise<BoltReportState> {
  if (!(await isAuthenticated())) return { error: "Nu ești autentificat." };

  const files = formData.getAll("bolt_csv").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Nu a fost selectat niciun fișier." };

  try {
    const allRows = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".csv")) return { error: `Format nesuportat: ${file.name}. Bolt exportă CSV.` };
      const rows = parseCsv(await file.text());
      if (rows.length === 0) continue;
      if (!("Provider Name" in rows[0])) return { error: `Format Bolt invalid în "${file.name}".` };
      allRows.push(...rows);
    }
    if (allRows.length === 0) return { error: "Fișierele selectate nu conțin date." };
    return { report: buildBoltReportFromRows(allRows) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Eroare la procesare." };
  }
}

export async function glovoReportAction(_prev: GlovoReportState, formData: FormData): Promise<GlovoReportState> {
  if (!(await isAuthenticated())) return { error: "Nu ești autentificat." };

  const files = formData.getAll("glovo_xlsx").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Nu a fost selectat niciun fișier." };

  try {
    const allRows = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: `Format nesuportat: ${file.name}. Glovo exportă XLSX.` };
      const rows = await parseXlsx(await file.arrayBuffer());
      if (rows.length === 0) continue;
      if (!("Denumire restaurant" in rows[0])) return { error: `Format Glovo invalid în "${file.name}".` };
      allRows.push(...rows);
    }
    if (allRows.length === 0) return { error: "Fișierele selectate nu conțin date." };
    return { report: buildGlovoReportFromRows(allRows) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Eroare la procesare." };
  }
}

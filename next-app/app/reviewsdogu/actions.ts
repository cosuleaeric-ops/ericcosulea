"use server";

import { revalidatePath } from "next/cache";
import { isAuthenticated } from "@/lib/session";
import { parseCsv, parseXlsx } from "@/lib/reviewsdogu/parsers";
import { saveBoltRows, saveGlovoRows } from "@/lib/reviewsdogu/import";

type ActionState = { error?: string; success?: string } | undefined;

export async function importAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAuthenticated())) return { error: "Nu ești autentificat." };

  const platform = String(formData.get("platform") ?? "");
  if (platform !== "bolt" && platform !== "glovo") {
    return { error: "Selectează o platformă validă." };
  }

  const files = formData.getAll("report_files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Nu a fost selectat niciun fișier." };

  try {
    let totalSaved = 0;
    let totalSkipped = 0;

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let rows;
      if (ext === "csv") {
        rows = parseCsv(await file.text());
      } else if (ext === "xlsx") {
        rows = await parseXlsx(await file.arrayBuffer());
      } else {
        return { error: `Format nesuportat: ${file.name}` };
      }

      if (rows.length === 0) continue;

      if (platform === "bolt" && !("Provider Name" in rows[0])) {
        return { error: `Format Bolt invalid în "${file.name}" (lipsește "Provider Name").` };
      }
      if (platform === "glovo" && !("Denumire restaurant" in rows[0])) {
        return { error: `Format Glovo invalid în "${file.name}" (lipsește "Denumire restaurant").` };
      }

      const result = platform === "bolt" ? await saveBoltRows(rows) : await saveGlovoRows(rows);
      totalSaved += result.saved;
      totalSkipped += result.skipped;
    }

    revalidatePath("/reviewsdogu");
    return { success: `Importate: ${totalSaved} comenzi noi, ${totalSkipped} duplicate ignorate.` };
  } catch (err) {
    console.error("Import error", err);
    return { error: err instanceof Error ? err.message : "Eroare la import." };
  }
}

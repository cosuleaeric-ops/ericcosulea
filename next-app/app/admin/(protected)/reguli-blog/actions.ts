"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { siteTexts } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";
import { CHEI } from "./reguli";

export type StareSalvare = { error?: string; salvatLa?: string } | undefined;

export async function salveazaReguliAction(
  _prev: StareSalvare,
  formData: FormData,
): Promise<StareSalvare> {
  if (!(await isAuthenticated())) return { error: "Nu ești autentificat." };

  const acum = new Date();
  for (const [nume, cheie] of Object.entries(CHEI)) {
    // Trimiterea formularului transformă \n în \r\n, conform specificației HTML.
    // Le normalizez, altfel textul crește cu un caracter pe linie la fiecare salvare.
    const valoare = String(formData.get(nume) ?? "").replace(/\r\n/g, "\n");
    await db
      .insert(siteTexts)
      .values({ textKey: cheie, textValue: valoare, updatedAt: acum })
      .onConflictDoUpdate({
        target: siteTexts.textKey,
        set: { textValue: valoare, updatedAt: acum },
      });
  }

  revalidatePath("/admin/reguli-blog");
  return { salvatLa: acum.toISOString() };
}

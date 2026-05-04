"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { cheltuialaCategorii, cheltuieli, portofel, venitCategorii, venituri } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

type ActionState = { error?: string } | undefined;

async function ensureAuth(): Promise<string | null> {
  return (await isAuthenticated()) ? null : "Nu ești autentificat.";
}

function parseAmount(s: string): number | null {
  const v = parseFloat(String(s).replace(",", ".").trim());
  return isNaN(v) ? null : v;
}

export async function addVenitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const data = String(fd.get("data") ?? "").trim();
  const descriere = String(fd.get("descriere") ?? "").trim();
  const suma = parseAmount(String(fd.get("suma") ?? ""));
  if (!data || !descriere || suma == null) return { error: "Date / descriere / sumă obligatorii." };
  await db.insert(venituri).values({ data, descriere, suma });
  revalidatePath("/pnlpersonal");
  return undefined;
}

export async function addCheltuialaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const data = String(fd.get("data") ?? "").trim();
  const categorie = String(fd.get("categorie") ?? "").trim();
  const detalii = String(fd.get("detalii") ?? "").trim();
  const suma = parseAmount(String(fd.get("suma") ?? ""));
  if (!data || !categorie || suma == null) return { error: "Date / categorie / sumă obligatorii." };
  await db.insert(cheltuieli).values({ data, categorie, detalii, suma });
  revalidatePath("/pnlpersonal");
  return undefined;
}

export async function addPortofelAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const data = String(fd.get("data") ?? "").trim();
  const cash = parseAmount(String(fd.get("cash") ?? "0")) ?? 0;
  const ing = parseAmount(String(fd.get("ing") ?? "0")) ?? 0;
  const revolut = parseAmount(String(fd.get("revolut") ?? "0")) ?? 0;
  const trading212 = parseAmount(String(fd.get("trading212") ?? "0")) ?? 0;
  if (!data) return { error: "Data obligatorie." };
  await db.insert(portofel).values({ data, cash, ing, revolut, trading212 });
  revalidatePath("/pnlpersonal");
  return undefined;
}

export async function deleteVenitAction(fd: FormData) {
  if (!(await isAuthenticated())) return;
  const id = Number(fd.get("id"));
  if (!id) return;
  await db.delete(venituri).where(eq(venituri.id, id));
  revalidatePath("/pnlpersonal");
}

export async function deleteCheltuialaAction(fd: FormData) {
  if (!(await isAuthenticated())) return;
  const id = Number(fd.get("id"));
  if (!id) return;
  await db.delete(cheltuieli).where(eq(cheltuieli.id, id));
  revalidatePath("/pnlpersonal");
}

export async function deletePortofelAction(fd: FormData) {
  if (!(await isAuthenticated())) return;
  const id = Number(fd.get("id"));
  if (!id) return;
  await db.delete(portofel).where(eq(portofel.id, id));
  revalidatePath("/pnlpersonal");
}

export async function addCategorieVenitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const nume = String(fd.get("nume") ?? "").trim();
  if (!nume) return { error: "Nume obligatoriu." };
  try {
    await db.insert(venitCategorii).values({ nume });
  } catch {
    return { error: "Categoria există deja." };
  }
  revalidatePath("/pnlpersonal");
  return undefined;
}

export async function addCategorieCheltuialaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const nume = String(fd.get("nume") ?? "").trim();
  if (!nume) return { error: "Nume obligatoriu." };
  try {
    await db.insert(cheltuialaCategorii).values({ nume });
  } catch {
    return { error: "Categoria există deja." };
  }
  revalidatePath("/pnlpersonal");
  return undefined;
}

export async function editVenitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const id = Number(fd.get("id"));
  const data = String(fd.get("data") ?? "").trim();
  const descriere = String(fd.get("descriere") ?? "").trim();
  const suma = parseAmount(String(fd.get("suma") ?? ""));
  if (!id || !data || !descriere || suma == null) return { error: "Date / descriere / sumă obligatorii." };
  await db.update(venituri).set({ data, descriere, suma }).where(eq(venituri.id, id));
  revalidatePath("/pnlpersonal");
  return undefined;
}

export async function editCheltuialaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const id = Number(fd.get("id"));
  const data = String(fd.get("data") ?? "").trim();
  const categorie = String(fd.get("categorie") ?? "").trim();
  const detalii = String(fd.get("detalii") ?? "").trim();
  const suma = parseAmount(String(fd.get("suma") ?? ""));
  if (!id || !data || !categorie || suma == null) return { error: "Date / categorie / sumă obligatorii." };
  await db.update(cheltuieli).set({ data, categorie, detalii, suma }).where(eq(cheltuieli.id, id));
  revalidatePath("/pnlpersonal");
  return undefined;
}

export async function editPortofelAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const err = await ensureAuth(); if (err) return { error: err };
  const id = Number(fd.get("id"));
  const data = String(fd.get("data") ?? "").trim();
  const cash = parseAmount(String(fd.get("cash") ?? "0")) ?? 0;
  const ing = parseAmount(String(fd.get("ing") ?? "0")) ?? 0;
  const revolut = parseAmount(String(fd.get("revolut") ?? "0")) ?? 0;
  const trading212 = parseAmount(String(fd.get("trading212") ?? "0")) ?? 0;
  if (!id || !data) return { error: "Id / dată obligatorii." };
  await db.update(portofel).set({ data, cash, ing, revolut, trading212 }).where(eq(portofel.id, id));
  revalidatePath("/pnlpersonal");
  return undefined;
}

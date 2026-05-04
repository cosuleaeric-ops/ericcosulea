"use server";

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

type ActionState = { error?: string } | undefined;

const ALLOWED_LOGO_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);

async function uploadLogo(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_LOGO_EXT.has(ext)) {
    throw new Error("Tipul logo-ului nu e permis (jpg/png/webp/gif/svg).");
  }
  const safeName = `logo-${randomBytes(6).toString("hex")}-${Math.floor(Date.now() / 1000)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const blob = await put(`logos/${safeName}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });
  return blob.url;
}

export async function saveProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAuthenticated())) return { error: "Nu ești autentificat." };

  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : undefined;
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const sort = Number(formData.get("sort") ?? 99);
  const existingLogo = String(formData.get("existing_logo") ?? "").trim();
  const logoFile = formData.get("logo_file");

  if (!name) return { error: "Numele e obligatoriu." };
  if (!url) return { error: "URL-ul e obligatoriu." };

  let logo = existingLogo;
  if (logoFile instanceof File && logoFile.size > 0) {
    try {
      logo = await uploadLogo(logoFile);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Upload eșuat." };
    }
  }
  if (!logo) return { error: "Logo-ul e obligatoriu." };

  try {
    if (id != null) {
      await db.update(projects).set({
        name,
        description: description || null,
        url,
        logo,
        sort,
      }).where(eq(projects.id, id));
    } else {
      await db.insert(projects).values({
        name,
        description: description || null,
        url,
        logo,
        sort,
      });
    }
  } catch (err) {
    console.error("saveProjectAction DB error", err);
    return { error: err instanceof Error ? err.message : "Eroare la salvare." };
  }

  revalidatePath("/");
  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}

export async function deleteProjectAction(formData: FormData) {
  if (!(await isAuthenticated())) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/");
  revalidatePath("/admin/projects");
}

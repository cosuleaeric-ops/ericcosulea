"use server";

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";
import { BLOB_BASE_URL } from "@/lib/blob";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

export async function uploadInspoAction(formData: FormData): Promise<{ error?: string }> {
  if (!(await isAuthenticated())) return { error: "unauth" };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { error: "Fișier lipsă." };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.has(ext)) return { error: "Tipul fișierului nu e permis." };

  const safeName = `${randomBytes(8).toString("hex")}-${Math.floor(Date.now() / 1000)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await put(`inspo/${safeName}`, buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: false,
    token: process.env.BLOB_READ_WRITE_TOKEN!,
  });

  await db.insert(images).values({
    filename: safeName,
    originalName: file.name,
    createdAt: new Date(),
  });

  revalidatePath("/inspo");
  revalidatePath("/");
  return {};
}

export async function deleteInspoAction(formData: FormData) {
  if (!(await isAuthenticated())) return;
  const id = Number(formData.get("id"));
  if (!id) return;

  const rows = await db.select().from(images).where(eq(images.id, id)).limit(1);
  const img = rows[0];
  if (!img) return;

  try {
    await del(`${BLOB_BASE_URL}/inspo/${img.filename}`, {
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });
  } catch (err) {
    console.error("Blob delete failed", err);
  }

  await db.delete(images).where(eq(images.id, id));
  revalidatePath("/inspo");
  revalidatePath("/");
}

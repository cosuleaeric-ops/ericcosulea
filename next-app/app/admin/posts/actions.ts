"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

function parseInput(formData: FormData) {
  const idRaw = formData.get("id");
  const id = idRaw ? Number(idRaw) : undefined;
  const slug = String(formData.get("slug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const contentHtml = String(formData.get("content_html") ?? "").trim();
  const excerptRaw = String(formData.get("excerpt") ?? "").trim();
  const publishedAtRaw = String(formData.get("published_at") ?? "").trim();
  return {
    id,
    slug,
    title,
    contentHtml,
    excerpt: excerptRaw === "" ? null : excerptRaw,
    publishedAt: publishedAtRaw ? new Date(publishedAtRaw) : null,
  };
}

export async function savePostAction(formData: FormData): Promise<{ error?: string; redirectTo?: string }> {
  if (!(await isAuthenticated())) return { error: "Nu ești autentificat." };

  const data = parseInput(formData);
  if (!data.title) return { error: "Titlul e obligatoriu." };
  if (!data.slug || !/^[a-z0-9\-]+$/.test(data.slug)) return { error: "Slug invalid (doar a-z, 0-9, -)." };
  if (!data.contentHtml) return { error: "Conținutul e obligatoriu." };
  if (!data.publishedAt || isNaN(data.publishedAt.getTime())) return { error: "Data invalidă." };

  try {
    if (data.id != null) {
      await db.update(posts).set({
        slug: data.slug,
        title: data.title,
        contentHtml: data.contentHtml,
        excerpt: data.excerpt,
        publishedAt: data.publishedAt,
      }).where(eq(posts.id, data.id));
    } else {
      await db.insert(posts).values({
        slug: data.slug,
        title: data.title,
        contentHtml: data.contentHtml,
        excerpt: data.excerpt,
        publishedAt: data.publishedAt,
      });
    }
  } catch (err) {
    console.error("savePostAction DB error", err);
    const message = err instanceof Error ? err.message : "Eroare necunoscută";
    if (/duplicate|unique/i.test(message)) {
      return { error: `Slug "${data.slug}" există deja.` };
    }
    return { error: `Eroare la salvare: ${message}` };
  }

  try {
    revalidatePath("/blog");
    revalidatePath(`/${data.slug}`);
    revalidatePath("/admin/posts");
  } catch (err) {
    console.error("revalidatePath failed", err);
  }

  return { redirectTo: "/admin/posts" };
}

export async function deletePostAction(formData: FormData) {
  if (!(await isAuthenticated())) return;
  const id = Number(formData.get("id"));
  if (!id) return;
  try {
    await db.delete(posts).where(eq(posts.id, id));
    revalidatePath("/blog");
    revalidatePath("/admin/posts");
  } catch (err) {
    console.error("deletePostAction error", err);
  }
}

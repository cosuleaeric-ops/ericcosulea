"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";

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
  const data = parseInput(formData);
  if (!data.title) return { error: "Titlul e obligatoriu." };
  if (!data.slug || !/^[a-z0-9\-]+$/.test(data.slug)) return { error: "Slug invalid (doar a-z, 0-9, -)." };
  if (!data.contentHtml) return { error: "Conținutul e obligatoriu." };
  if (!data.publishedAt || isNaN(data.publishedAt.getTime())) return { error: "Data invalidă." };

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

  revalidatePath("/blog");
  revalidatePath(`/${data.slug}`);
  revalidatePath("/admin/posts");
  return { redirectTo: "/admin/posts" };
}

export async function deletePostAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePath("/blog");
  revalidatePath("/admin/posts");
}

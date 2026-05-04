import { asc, desc, eq } from "drizzle-orm";
import { db } from "./index";
import { images, posts, projects } from "./schema";

export async function getProjectsForHome() {
  return db.select().from(projects).orderBy(asc(projects.sort), asc(projects.id));
}

export async function getLatestImages(limit = 8) {
  return db.select().from(images).orderBy(desc(images.createdAt)).limit(limit);
}

export async function getAllImages() {
  return db.select().from(images).orderBy(desc(images.createdAt));
}

export async function getAllPosts() {
  return db.select({
    slug: posts.slug,
    title: posts.title,
    excerpt: posts.excerpt,
    publishedAt: posts.publishedAt,
  }).from(posts).orderBy(desc(posts.publishedAt));
}

export async function getPostBySlug(slug: string) {
  const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return rows[0] ?? null;
}

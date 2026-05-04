import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "./index";
import { cheltuialaCategorii, cheltuieli, images, pages, portofel, posts, projects, venitCategorii, venituri } from "./schema";

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

export async function getPageBySlug(slug: string) {
  const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getAllPostsForAdmin() {
  return db.select({
    id: posts.id,
    slug: posts.slug,
    title: posts.title,
    publishedAt: posts.publishedAt,
  }).from(posts).orderBy(desc(posts.publishedAt));
}

export async function getPostById(id: number) {
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getProjectById(id: number) {
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getVenituriByMonth(yyyymm: string) {
  const start = `${yyyymm}-01`;
  const end = `${yyyymm}-31`;
  return db.select().from(venituri).where(and(gte(venituri.data, start), lte(venituri.data, end))).orderBy(asc(venituri.data), asc(venituri.id));
}

export async function getCheltuieliByMonth(yyyymm: string) {
  const start = `${yyyymm}-01`;
  const end = `${yyyymm}-31`;
  return db.select().from(cheltuieli).where(and(gte(cheltuieli.data, start), lte(cheltuieli.data, end))).orderBy(asc(cheltuieli.data), asc(cheltuieli.id));
}

export async function getCategoriiVenit() {
  return db.select().from(venitCategorii).orderBy(asc(venitCategorii.nume));
}

export async function getCategoriiCheltuiala() {
  return db.select().from(cheltuialaCategorii).orderBy(asc(cheltuialaCategorii.nume));
}

export async function getLatestPortofel() {
  const rows = await db.select().from(portofel).orderBy(desc(portofel.data), desc(portofel.id)).limit(1);
  return rows[0] ?? null;
}

export async function getAllPortofel() {
  return db.select().from(portofel).orderBy(desc(portofel.data), desc(portofel.id));
}

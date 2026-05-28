import { cache } from "react";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "./index";
import { cheltuialaCategorii, cheltuieli, images, pages, portofel, posts, projects, venitCategorii, venituri } from "./schema";

export const getProjectsForHome = cache(async () => {
  return db.select().from(projects).orderBy(asc(projects.sort), asc(projects.id));
});

export const getLatestImages = cache(async (limit = 8) => {
  return db.select().from(images).orderBy(desc(images.createdAt)).limit(limit);
});

export const getAllImages = cache(async () => {
  return db.select().from(images).orderBy(desc(images.createdAt));
});

export const getAllPosts = cache(async () => {
  return db.select({
    slug: posts.slug,
    title: posts.title,
    excerpt: posts.excerpt,
    publishedAt: posts.publishedAt,
  }).from(posts).orderBy(desc(posts.publishedAt));
});

export const getPostBySlug = cache(async (slug: string) => {
  const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return rows[0] ?? null;
});

export const getPageBySlug = cache(async (slug: string) => {
  const rows = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  return rows[0] ?? null;
});

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

const yearDateRange = (yyyy: string) => ({ start: `${yyyy}-01-01`, end: `${yyyy}-12-31` });

export async function getVenituriByYear(yyyy: string) {
  const { start, end } = yearDateRange(yyyy);
  return db.select().from(venituri).where(and(gte(venituri.data, start), lte(venituri.data, end))).orderBy(asc(venituri.data), asc(venituri.id));
}

export async function getCheltuieliByYear(yyyy: string) {
  const { start, end } = yearDateRange(yyyy);
  return db.select().from(cheltuieli).where(and(gte(cheltuieli.data, start), lte(cheltuieli.data, end))).orderBy(asc(cheltuieli.data), asc(cheltuieli.id));
}

export async function getPortofelByYear(yyyy: string) {
  const { start, end } = yearDateRange(yyyy);
  return db.select().from(portofel).where(and(gte(portofel.data, start), lte(portofel.data, end))).orderBy(desc(portofel.data), desc(portofel.id));
}

export async function getDistinctMonthsWithEntries(): Promise<string[]> {
  const result = await db.execute<{ month: string }>(sql`
    SELECT month FROM (
      SELECT DISTINCT LEFT(data, 7) AS month FROM venituri
      UNION
      SELECT DISTINCT LEFT(data, 7) AS month FROM cheltuieli
    ) AS months
    ORDER BY month DESC
  `);
  return result.rows.map((r) => r.month);
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

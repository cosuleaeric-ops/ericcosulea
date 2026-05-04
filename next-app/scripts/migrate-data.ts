import dotenv from "dotenv";
import Database from "better-sqlite3";

dotenv.config({ path: ".env.local" });
import { readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/schema";

type SqlitePost = {
  id: number;
  slug: string;
  title: string;
  content_html: string;
  content_md: string | null;
  excerpt: string | null;
  published_at: string;
};

type SqliteImage = {
  id: number;
  filename: string;
  original_name: string | null;
  created_at: string;
};

type SqlitePage = {
  id: number;
  slug: string;
  title: string;
  content_html: string;
  content_md: string | null;
  updated_at: string;
};

type SqliteSiteText = {
  id: number;
  text_key: string;
  text_value: string;
  updated_at: string;
};

type ProjectJson = {
  id: number;
  name: string;
  description: string;
  url: string;
  logo: string;
  sort: number;
};

const sqliteDateToUtc = (s: string) => {
  if (/T|[Z+]/.test(s)) return new Date(s);
  return new Date(s.replace(" ", "T") + "Z");
};

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  const sqlitePath = resolve(__dirname, "../../data/blog.sqlite");
  const projectsPath = resolve(__dirname, "../../data/projects.json");

  const sqlite = new Database(sqlitePath, { readonly: true });
  const sqlitePosts = sqlite.prepare("SELECT * FROM posts").all() as SqlitePost[];
  const sqliteImages = sqlite.prepare("SELECT * FROM images").all() as SqliteImage[];
  const sqlitePages = sqlite.prepare("SELECT * FROM pages").all() as SqlitePage[];
  const sqliteSiteTexts = sqlite.prepare("SELECT * FROM site_texts").all() as SqliteSiteText[];
  sqlite.close();

  const projectsRaw = JSON.parse(readFileSync(projectsPath, "utf-8")) as ProjectJson[];

  console.log(`Found ${sqlitePosts.length} posts, ${sqliteImages.length} images, ${projectsRaw.length} projects, ${sqlitePages.length} pages, ${sqliteSiteTexts.length} site_texts.`);

  await db.delete(schema.posts);
  await db.delete(schema.images);
  await db.delete(schema.projects);
  await db.delete(schema.pages);
  await db.delete(schema.siteTexts);

  if (sqlitePosts.length) {
    await db.insert(schema.posts).values(sqlitePosts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      contentHtml: p.content_html,
      contentMd: p.content_md,
      excerpt: p.excerpt,
      publishedAt: sqliteDateToUtc(p.published_at),
    })));
  }

  if (sqliteImages.length) {
    await db.insert(schema.images).values(sqliteImages.map((i) => ({
      id: i.id,
      filename: i.filename,
      originalName: i.original_name,
      createdAt: sqliteDateToUtc(i.created_at),
    })));
  }

  if (projectsRaw.length) {
    await db.insert(schema.projects).values(projectsRaw.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || null,
      url: p.url,
      logo: p.logo,
      sort: p.sort,
    })));
  }

  if (sqlitePages.length) {
    await db.insert(schema.pages).values(sqlitePages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      contentHtml: p.content_html,
      contentMd: p.content_md,
      updatedAt: sqliteDateToUtc(p.updated_at),
    })));
  }

  if (sqliteSiteTexts.length) {
    await db.insert(schema.siteTexts).values(sqliteSiteTexts.map((t) => ({
      id: t.id,
      textKey: t.text_key,
      textValue: t.text_value,
      updatedAt: sqliteDateToUtc(t.updated_at),
    })));
  }

  for (const table of ["posts", "images", "projects", "pages", "site_texts"]) {
    await sql.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0))`);
  }
  console.log("Sequences reset to MAX(id) for all migrated tables.");

  const [{ count: postCount }] = (await sql`SELECT COUNT(*)::int AS count FROM posts`) as Array<{ count: number }>;
  const [{ count: imageCount }] = (await sql`SELECT COUNT(*)::int AS count FROM images`) as Array<{ count: number }>;
  const [{ count: projectCount }] = (await sql`SELECT COUNT(*)::int AS count FROM projects`) as Array<{ count: number }>;
  const [{ count: pageCount }] = (await sql`SELECT COUNT(*)::int AS count FROM pages`) as Array<{ count: number }>;
  const [{ count: siteTextCount }] = (await sql`SELECT COUNT(*)::int AS count FROM site_texts`) as Array<{ count: number }>;

  console.log(`Migrated to Neon: ${postCount} posts, ${imageCount} images, ${projectCount} projects, ${pageCount} pages, ${siteTextCount} site_texts.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

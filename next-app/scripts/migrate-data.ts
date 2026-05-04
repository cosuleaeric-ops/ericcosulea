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

type ProjectJson = {
  id: number;
  name: string;
  description: string;
  url: string;
  logo: string;
  sort: number;
};

const sqliteDateToUtc = (s: string) => new Date(s.replace(" ", "T") + "Z");

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  const sqlitePath = resolve(__dirname, "../../data/blog.sqlite");
  const projectsPath = resolve(__dirname, "../../data/projects.json");

  const sqlite = new Database(sqlitePath, { readonly: true });
  const sqlitePosts = sqlite.prepare("SELECT * FROM posts").all() as SqlitePost[];
  const sqliteImages = sqlite.prepare("SELECT * FROM images").all() as SqliteImage[];
  sqlite.close();

  const projectsRaw = JSON.parse(readFileSync(projectsPath, "utf-8")) as ProjectJson[];

  console.log(`Found ${sqlitePosts.length} posts, ${sqliteImages.length} images, ${projectsRaw.length} projects.`);

  await db.delete(schema.posts);
  await db.delete(schema.images);
  await db.delete(schema.projects);

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

  const [{ count: postCount }] = (await sql`SELECT COUNT(*)::int AS count FROM posts`) as Array<{ count: number }>;
  const [{ count: imageCount }] = (await sql`SELECT COUNT(*)::int AS count FROM images`) as Array<{ count: number }>;
  const [{ count: projectCount }] = (await sql`SELECT COUNT(*)::int AS count FROM projects`) as Array<{ count: number }>;

  console.log(`Migrated to Neon: ${postCount} posts, ${imageCount} images, ${projectCount} projects.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

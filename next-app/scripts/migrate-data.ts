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

type SqliteVenit = { id: number; data: string; descriere: string; suma: number; created_at: string };
type SqliteCheltuiala = { id: number; data: string; categorie: string; detalii: string; suma: number; created_at: string };
type SqliteCategorie = { id: number; nume: string };
type SqlitePortofel = { id: number; data: string; cash: number; ing: number; revolut: number; trading212: number; created_at: string };

type SqliteOrder = {
  id: number;
  platform: string;
  order_id: string;
  restaurant_key: string;
  restaurant_name: string;
  order_date: string;
  order_time: string;
  status: string;
  order_amount: number;
  rating: number | null;
  rating_comment: string;
  waiting_tax: number;
  refund_amount: number;
  cancel_reason: string;
  cancel_responsible: string;
  has_complaint: number;
  complaint_reason: string;
  imported_at: string;
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
  const reviewsdoguPath = resolve(__dirname, "../../reviewsdogu/data/reviewsdogu.sqlite");
  const pnlPath = resolve(__dirname, "../../pnlpersonal/data/pnlpersonal.sqlite");

  const sqlite = new Database(sqlitePath, { readonly: true });
  const sqlitePosts = sqlite.prepare("SELECT * FROM posts").all() as SqlitePost[];
  const sqliteImages = sqlite.prepare("SELECT * FROM images").all() as SqliteImage[];
  const sqlitePages = sqlite.prepare("SELECT * FROM pages").all() as SqlitePage[];
  const sqliteSiteTexts = sqlite.prepare("SELECT * FROM site_texts").all() as SqliteSiteText[];
  sqlite.close();

  const reviewsDb = new Database(reviewsdoguPath, { readonly: true });
  const sqliteOrders = reviewsDb.prepare("SELECT * FROM orders").all() as SqliteOrder[];
  reviewsDb.close();

  const pnlDb = new Database(pnlPath, { readonly: true });
  const sqliteVenituri = pnlDb.prepare("SELECT * FROM venituri").all() as SqliteVenit[];
  const sqliteCheltuieli = pnlDb.prepare("SELECT * FROM cheltuieli").all() as SqliteCheltuiala[];
  const sqliteVenitCategorii = pnlDb.prepare("SELECT * FROM venit_categorii").all() as SqliteCategorie[];
  const sqliteCheltCategorii = pnlDb.prepare("SELECT * FROM cheltuiala_categorii").all() as SqliteCategorie[];
  const sqlitePortofel = pnlDb.prepare("SELECT * FROM portofel").all() as SqlitePortofel[];
  pnlDb.close();

  const projectsRaw = JSON.parse(readFileSync(projectsPath, "utf-8")) as ProjectJson[];

  console.log(`Found ${sqlitePosts.length} posts, ${sqliteImages.length} images, ${projectsRaw.length} projects, ${sqlitePages.length} pages, ${sqliteSiteTexts.length} site_texts, ${sqliteOrders.length} orders, ${sqliteVenituri.length} venituri, ${sqliteCheltuieli.length} cheltuieli, ${sqlitePortofel.length} portofel snapshots.`);

  await db.delete(schema.posts);
  await db.delete(schema.images);
  await db.delete(schema.projects);
  await db.delete(schema.pages);
  await db.delete(schema.siteTexts);
  await db.delete(schema.orders);
  await db.delete(schema.venituri);
  await db.delete(schema.cheltuieli);
  await db.delete(schema.venitCategorii);
  await db.delete(schema.cheltuialaCategorii);
  await db.delete(schema.portofel);

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

  if (sqliteVenitCategorii.length) {
    await db.insert(schema.venitCategorii).values(sqliteVenitCategorii.map((c) => ({ id: c.id, nume: c.nume })));
  }
  if (sqliteCheltCategorii.length) {
    await db.insert(schema.cheltuialaCategorii).values(sqliteCheltCategorii.map((c) => ({ id: c.id, nume: c.nume })));
  }
  if (sqliteVenituri.length) {
    await db.insert(schema.venituri).values(sqliteVenituri.map((v) => ({
      id: v.id, data: v.data, descriere: v.descriere, suma: v.suma, createdAt: sqliteDateToUtc(v.created_at),
    })));
  }
  if (sqliteCheltuieli.length) {
    const batchSize = 200;
    for (let i = 0; i < sqliteCheltuieli.length; i += batchSize) {
      const batch = sqliteCheltuieli.slice(i, i + batchSize);
      await db.insert(schema.cheltuieli).values(batch.map((c) => ({
        id: c.id, data: c.data, categorie: c.categorie, detalii: c.detalii, suma: c.suma, createdAt: sqliteDateToUtc(c.created_at),
      })));
    }
  }
  if (sqlitePortofel.length) {
    await db.insert(schema.portofel).values(sqlitePortofel.map((p) => ({
      id: p.id, data: p.data, cash: p.cash, ing: p.ing, revolut: p.revolut, trading212: p.trading212, createdAt: sqliteDateToUtc(p.created_at),
    })));
  }

  if (sqliteOrders.length) {
    const batchSize = 200;
    for (let i = 0; i < sqliteOrders.length; i += batchSize) {
      const batch = sqliteOrders.slice(i, i + batchSize);
      await db.insert(schema.orders).values(batch.map((o) => ({
        id: o.id,
        platform: o.platform,
        orderId: o.order_id,
        restaurantKey: o.restaurant_key,
        restaurantName: o.restaurant_name,
        orderDate: o.order_date,
        orderTime: o.order_time,
        status: o.status,
        orderAmount: o.order_amount,
        rating: o.rating,
        ratingComment: o.rating_comment,
        waitingTax: o.waiting_tax,
        refundAmount: o.refund_amount,
        cancelReason: o.cancel_reason,
        cancelResponsible: o.cancel_responsible,
        hasComplaint: o.has_complaint === 1,
        complaintReason: o.complaint_reason,
        importedAt: sqliteDateToUtc(o.imported_at),
      })));
    }
  }

  for (const table of ["posts", "images", "projects", "pages", "site_texts", "orders", "venituri", "cheltuieli", "venit_categorii", "cheltuiala_categorii", "portofel"]) {
    await sql.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0))`);
  }
  console.log("Sequences reset to MAX(id) for all migrated tables.");

  const [{ count: postCount }] = (await sql`SELECT COUNT(*)::int AS count FROM posts`) as Array<{ count: number }>;
  const [{ count: imageCount }] = (await sql`SELECT COUNT(*)::int AS count FROM images`) as Array<{ count: number }>;
  const [{ count: projectCount }] = (await sql`SELECT COUNT(*)::int AS count FROM projects`) as Array<{ count: number }>;
  const [{ count: pageCount }] = (await sql`SELECT COUNT(*)::int AS count FROM pages`) as Array<{ count: number }>;
  const [{ count: siteTextCount }] = (await sql`SELECT COUNT(*)::int AS count FROM site_texts`) as Array<{ count: number }>;
  const [{ count: orderCount }] = (await sql`SELECT COUNT(*)::int AS count FROM orders`) as Array<{ count: number }>;
  const [{ count: venitCount }] = (await sql`SELECT COUNT(*)::int AS count FROM venituri`) as Array<{ count: number }>;
  const [{ count: cheltCount }] = (await sql`SELECT COUNT(*)::int AS count FROM cheltuieli`) as Array<{ count: number }>;
  const [{ count: portofelCount }] = (await sql`SELECT COUNT(*)::int AS count FROM portofel`) as Array<{ count: number }>;

  console.log(`Migrated to Neon: ${postCount} posts, ${imageCount} images, ${projectCount} projects, ${pageCount} pages, ${siteTextCount} site_texts, ${orderCount} orders, ${venitCount} venituri, ${cheltCount} cheltuieli, ${portofelCount} portofel snapshots.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

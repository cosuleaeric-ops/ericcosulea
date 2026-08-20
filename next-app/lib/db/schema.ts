import { pgTable, serial, text, timestamp, integer, real, boolean, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  contentHtml: text("content_html").notNull(),
  contentMd: text("content_md"),
  excerpt: text("excerpt"),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
});

export const images = pgTable("images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull().unique(),
  originalName: text("original_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const copyImages = pgTable("copy_images", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull().unique(),
  originalName: text("original_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  logo: text("logo").notNull(),
  sort: integer("sort").notNull(),
});

export const pages = pgTable("pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  contentHtml: text("content_html").notNull(),
  contentMd: text("content_md"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const siteTexts = pgTable("site_texts", {
  id: serial("id").primaryKey(),
  textKey: text("text_key").notNull().unique(),
  textValue: text("text_value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  orderId: text("order_id").notNull(),
  restaurantKey: text("restaurant_key").notNull(),
  restaurantName: text("restaurant_name").notNull(),
  orderDate: text("order_date").notNull(),
  orderTime: text("order_time").notNull().default(""),
  status: text("status").notNull(),
  orderAmount: real("order_amount").notNull().default(0),
  rating: integer("rating"),
  ratingComment: text("rating_comment").notNull().default(""),
  waitingTax: real("waiting_tax").notNull().default(0),
  refundAmount: real("refund_amount").notNull().default(0),
  cancelReason: text("cancel_reason").notNull().default(""),
  cancelResponsible: text("cancel_responsible").notNull().default(""),
  hasComplaint: boolean("has_complaint").notNull().default(false),
  complaintReason: text("complaint_reason").notNull().default(""),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex("orders_platform_order_id_unique").on(t.platform, t.orderId),
]);

export const venituri = pgTable("venituri", {
  id: serial("id").primaryKey(),
  data: text("data").notNull(),
  descriere: text("descriere").notNull(),
  suma: real("suma").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cheltuieli = pgTable("cheltuieli", {
  id: serial("id").primaryKey(),
  data: text("data").notNull(),
  categorie: text("categorie").notNull(),
  detalii: text("detalii").notNull().default(""),
  suma: real("suma").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const venitCategorii = pgTable("venit_categorii", {
  id: serial("id").primaryKey(),
  nume: text("nume").notNull().unique(),
});

export const cheltuialaCategorii = pgTable("cheltuiala_categorii", {
  id: serial("id").primaryKey(),
  nume: text("nume").notNull().unique(),
});

export const portofel = pgTable("portofel", {
  id: serial("id").primaryKey(),
  data: text("data").notNull(),
  cash: real("cash").notNull().default(0),
  ing: real("ing").notNull().default(0),
  revolut: real("revolut").notNull().default(0),
  trading212: real("trading212").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eliteDeuxState = pgTable("elite_deux_state", {
  id: integer("id").primaryKey(),
  state: jsonb("state").notNull(),
  // MOARTĂ din 8 aug 2026: topbar-ul macOS a fost șters. Coloana e goală și rămâne
  // doar ca `drizzle-kit push` să n-o dropeze; se poate scoate cu o migrare separată.
  topbar: jsonb("topbar"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ───────────────────────────── Brain (second brain, /brain) ─────────────────────────────
// Pages = cunoștințe durabile (arbore, markdown). Thoughts = notițe cronologice cu taguri.
// Consultat de AI la decizii prin /api/brain/export și MCP (/api/brain/mcp).

export const brainPages = pgTable("brain_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"), // null = pagină de top-level
  title: text("title").notNull(),
  description: text("description"), // subtitlul italic din listări
  icon: text("icon"), // emoji opțional în arbore
  contentMd: text("content_md").notNull().default(""),
  sort: integer("sort").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brainThoughts = pgTable("brain_thoughts", {
  id: serial("id").primaryKey(),
  contentMd: text("content_md").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// Analytics: tabelele (websites, events, crawler_events, goals, funnels,
// integrations_gsc, analytics_excluded_ips) au rămas în DB cu datele istorice
// din iunie-august 2026, dar definițiile au plecat odată cu EliteData pe 20 aug
// 2026 — tracking-ul e acum în PostHog. Se citesc cu SQL direct, dacă e nevoie.

// ───────────────────────────── EliteMail (clonă MailSuite, uz personal) ─────────────────────────────
// Extensia Chrome injectează un pixel + rescrie linkurile la trimitere din Gmail.
// `id` e generat de extensie și apare în URL-urile de pixel (/t/o/{id}) și click (/t/c/{id}?l=N).

export const trackedEmails = pgTable("tracked_emails", {
  id: text("id").primaryKey(), // generat de extensie (nanoid), public în URL-uri
  account: text("account"), // adresa expeditor (care dintre conturi)
  recipient: text("recipient"), // To (poate fi listă separată prin virgulă)
  subject: text("subject"),
  threadId: text("thread_id"), // threadId Gmail (reply vs compose nou)
  links: jsonb("links").$type<string[]>().notNull(), // destinațiile reale; indexul = parametrul ?l=
  senderIp: text("sender_ip"), // IP-ul expeditorului la trimitere — filtrează propriile deschideri
  ownerSeenAt: timestamp("owner_seen_at", { withTimezone: true }), // când proprietarul a văzut ultima dată emailul (extensia raportează) — suprimă propriile deschideri
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailEvents = pgTable("email_events", {
  id: serial("id").primaryKey(),
  emailId: text("email_id").notNull(),
  type: text("type").notNull(), // open | click
  linkIdx: integer("link_idx"), // doar la click
  linkUrl: text("link_url"), // denormalizat, pentru afișare
  userAgent: text("user_agent"),
  ip: text("ip"),
  isBot: boolean("is_bot").notNull().default(false), // prefetch/scanner (Apple MPP, SafeLinks…)
  alert: text("alert"), // null | reopen_week | high_count — semnal notificabil pe deschiderea asta
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("email_events_email_idx").on(t.emailId, t.createdAt),
]);

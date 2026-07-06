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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// ───────────────────────────── Analytics (DataFast clone) ─────────────────────────────
// Single-user: izolarea e implicită (un singur owner = adminul site-ului). Fără account_id.

export const websites = pgTable("websites", {
  id: serial("id").primaryKey(),
  publicId: text("public_id").notNull().unique(), // dfid_xxxx, folosit de scriptul de tracking
  domain: text("domain").notNull(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Europe/Bucharest"),
  faviconUrl: text("favicon_url"),
  plan: text("plan").notNull().default("free"), // neutilizat (fără billing), păstrat conform spec
  kpiGoalName: text("kpi_goal_name"), // numele goal-ului promovat ca "#1 KPI" configurabil
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  type: text("type").notNull(), // pageview | custom
  name: text("name"), // numele custom event-ului (ex: faq_tech_stack)
  path: text("path"),
  hostname: text("hostname"),
  referrerRaw: text("referrer_raw"),
  referrerSource: text("referrer_source"), // Google, Bing, Direct/None, ...
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  browser: text("browser"),
  os: text("os"),
  device: text("device"), // desktop | mobile | tablet
  visitorId: text("visitor_id"),
  sessionId: text("session_id"),
  isBounce: boolean("is_bounce").notNull().default(true),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("events_website_created_idx").on(t.websiteId, t.createdAt),
  index("events_website_type_idx").on(t.websiteId, t.type),
  index("events_website_name_idx").on(t.websiteId, t.name),
]);

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  name: text("name").notNull(), // numele tehnic al custom event-ului
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("goals_website_name_unique").on(t.websiteId, t.name),
]);

export const funnels = pgTable("funnels", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  name: text("name").notNull(),
  steps: jsonb("steps").notNull(), // listă de { type: "goal"|"path", value: string }
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const integrationsGsc = pgTable("integrations_gsc", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull().unique(),
  googleEmail: text("google_email"),
  gscSiteUrl: text("gsc_site_url"), // sc-domain:cesaicumpar.ro sau https://cesaicumpar.ro/
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("email_events_email_idx").on(t.emailId, t.createdAt),
]);

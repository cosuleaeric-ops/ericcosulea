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

// Peste events există view-ul SQL `events_human` (SELECT * ... WHERE NOT is_datacenter),
// folosit de toate query-urile de statistici. E creat cu SELECT * înghețat la creare:
// dacă adaugi coloane aici, recreează view-ul (CREATE OR REPLACE VIEW events_human ...).
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
  isDatacenter: boolean("is_datacenter").notNull().default(false), // IP de cloud/hosting (vezi lib/analytics/datacenter.ts)
  durationSeconds: integer("duration_seconds").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("events_website_created_idx").on(t.websiteId, t.createdAt),
  index("events_website_type_idx").on(t.websiteId, t.type),
  index("events_website_name_idx").on(t.websiteId, t.name),
  index("events_website_session_entry_idx").on(t.websiteId, t.sessionId, t.createdAt, t.id),
]);

// Probă temporară de headere (pusă 9 aug 2026). Fleet-urile cu proxy rezidențial
// trec de toate filtrele din /api/event: UA curat, IP rezidențial RO, dar
// 1 pageview la 0 secunde per „vizitator". Ca să le găsesc semnătura reală,
// salvez headerele evenimentelor ACCEPTATE și le compar cu ale traficului bun.
// Fără IP brut (doar un hash), fără corp de request. De șters după analiză.
export const eventHeaderProbe = pgTable("event_header_probe", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  visitorId: text("visitor_id"),
  path: text("path"),
  country: text("country"),
  city: text("city"),
  ipHash: text("ip_hash"),
  headers: jsonb("headers").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("event_header_probe_created_idx").on(t.createdAt)]);

// IP-urile mele. Traficul de pe ele nu se contorizează pe NICIUN site urmărit.
// Cookie-ul de admin nu poate face asta: pe outglow/cesaicumpar/etc. e
// third-party față de ericcosulea.ro, iar browserele nu-l trimit. IP-ul e
// singurul semnal care merge cross-domeniu, pe orice browser și device.
// Se auto-înregistrează la fiecare deschidere a dashboard-ului /elitedata
// (deci se reînnoiește singur când providerul rotește IP-ul) și se ignoră
// după 30 de zile fără reînnoire — ca un IP de hotel/cafenea prins o dată
// să nu blocheze la nesfârșit vizitatori reali de pe același NAT.
export const analyticsExcludedIps = pgTable("analytics_excluded_ips", {
  ip: text("ip").primaryKey(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Crawlere AI / boți — colectate server-side (nu rulează JS, deci nu trec prin /api/event).
export const crawlerEvents = pgTable("crawler_events", {
  id: serial("id").primaryKey(),
  websiteId: integer("website_id").notNull(),
  crawler: text("crawler").notNull(), // "GPTBot", "ClaudeBot", "PerplexityBot", ...
  category: text("category").notNull(), // answer | search | training | other
  path: text("path"),
  status: integer("status"), // status HTTP returnat (dacă e cunoscut)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("crawler_events_website_created_idx").on(t.websiteId, t.createdAt),
  index("crawler_events_website_crawler_idx").on(t.websiteId, t.crawler),
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

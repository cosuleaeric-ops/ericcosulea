import { pgTable, serial, text, timestamp, integer, real, boolean, uniqueIndex } from "drizzle-orm/pg-core";

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

export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

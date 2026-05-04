import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

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

export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

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

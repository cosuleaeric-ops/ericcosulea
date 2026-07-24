CREATE TABLE "brain_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"parent_id" integer,
	"title" text NOT NULL,
	"description" text,
	"icon" text,
	"content_md" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brain_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "brain_thoughts" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_md" text NOT NULL,
	"tags" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheltuiala_categorii" (
	"id" serial PRIMARY KEY NOT NULL,
	"nume" text NOT NULL,
	CONSTRAINT "cheltuiala_categorii_nume_unique" UNIQUE("nume")
);
--> statement-breakpoint
CREATE TABLE "cheltuieli" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"categorie" text NOT NULL,
	"detalii" text DEFAULT '' NOT NULL,
	"suma" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copy_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_name" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "copy_images_filename_unique" UNIQUE("filename")
);
--> statement-breakpoint
CREATE TABLE "crawler_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"crawler" text NOT NULL,
	"category" text NOT NULL,
	"path" text,
	"status" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elite_deux_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"state" jsonb NOT NULL,
	"topbar" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"email_id" text NOT NULL,
	"type" text NOT NULL,
	"link_idx" integer,
	"link_url" text,
	"user_agent" text,
	"ip" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"alert" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"type" text NOT NULL,
	"name" text,
	"path" text,
	"hostname" text,
	"referrer_raw" text,
	"referrer_source" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"country" text,
	"region" text,
	"city" text,
	"browser" text,
	"os" text,
	"device" text,
	"visitor_id" text,
	"session_id" text,
	"is_bounce" boolean DEFAULT true NOT NULL,
	"is_datacenter" boolean DEFAULT false NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"name" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_name" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "images_filename_unique" UNIQUE("filename")
);
--> statement-breakpoint
CREATE TABLE "integrations_gsc" (
	"id" serial PRIMARY KEY NOT NULL,
	"website_id" integer NOT NULL,
	"google_email" text,
	"gsc_site_url" text,
	"access_token" text,
	"refresh_token" text,
	"token_expiry" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_gsc_website_id_unique" UNIQUE("website_id")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"order_id" text NOT NULL,
	"restaurant_key" text NOT NULL,
	"restaurant_name" text NOT NULL,
	"order_date" text NOT NULL,
	"order_time" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"order_amount" real DEFAULT 0 NOT NULL,
	"rating" integer,
	"rating_comment" text DEFAULT '' NOT NULL,
	"waiting_tax" real DEFAULT 0 NOT NULL,
	"refund_amount" real DEFAULT 0 NOT NULL,
	"cancel_reason" text DEFAULT '' NOT NULL,
	"cancel_responsible" text DEFAULT '' NOT NULL,
	"has_complaint" boolean DEFAULT false NOT NULL,
	"complaint_reason" text DEFAULT '' NOT NULL,
	"imported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content_html" text NOT NULL,
	"content_md" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "portofel" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"cash" real DEFAULT 0 NOT NULL,
	"ing" real DEFAULT 0 NOT NULL,
	"revolut" real DEFAULT 0 NOT NULL,
	"trading212" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"content_html" text NOT NULL,
	"content_md" text,
	"excerpt" text,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"logo" text NOT NULL,
	"sort" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_texts" (
	"id" serial PRIMARY KEY NOT NULL,
	"text_key" text NOT NULL,
	"text_value" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "site_texts_text_key_unique" UNIQUE("text_key")
);
--> statement-breakpoint
CREATE TABLE "tracked_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"account" text,
	"recipient" text,
	"subject" text,
	"thread_id" text,
	"links" jsonb NOT NULL,
	"sender_ip" text,
	"owner_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venit_categorii" (
	"id" serial PRIMARY KEY NOT NULL,
	"nume" text NOT NULL,
	CONSTRAINT "venit_categorii_nume_unique" UNIQUE("nume")
);
--> statement-breakpoint
CREATE TABLE "venituri" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" text NOT NULL,
	"descriere" text NOT NULL,
	"suma" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "websites" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" text NOT NULL,
	"domain" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Bucharest' NOT NULL,
	"favicon_url" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"kpi_goal_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "websites_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE INDEX "crawler_events_website_created_idx" ON "crawler_events" USING btree ("website_id","created_at");--> statement-breakpoint
CREATE INDEX "crawler_events_website_crawler_idx" ON "crawler_events" USING btree ("website_id","crawler");--> statement-breakpoint
CREATE INDEX "email_events_email_idx" ON "email_events" USING btree ("email_id","created_at");--> statement-breakpoint
CREATE INDEX "events_website_created_idx" ON "events" USING btree ("website_id","created_at");--> statement-breakpoint
CREATE INDEX "events_website_type_idx" ON "events" USING btree ("website_id","type");--> statement-breakpoint
CREATE INDEX "events_website_name_idx" ON "events" USING btree ("website_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_website_name_unique" ON "goals" USING btree ("website_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_platform_order_id_unique" ON "orders" USING btree ("platform","order_id");
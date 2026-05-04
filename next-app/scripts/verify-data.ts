import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const projects = await sql`SELECT name, sort FROM projects ORDER BY sort`;
  console.log("Projects in Neon:");
  console.table(projects);
  const recentPosts = await sql`SELECT slug, title FROM posts ORDER BY published_at DESC LIMIT 5`;
  console.log("Most recent posts:");
  console.table(recentPosts);
  const imageSample = await sql`SELECT id, filename FROM images ORDER BY created_at DESC LIMIT 5`;
  console.log("Most recent images:");
  console.table(imageSample);
}

main().catch((e) => { console.error(e); process.exit(1); });

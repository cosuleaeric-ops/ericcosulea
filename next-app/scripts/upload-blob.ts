import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";
import { put } from "@vercel/blob";

const SOURCE_DIR = "../uploads";
const SKIP = new Set([".DS_Store", ".htaccess"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN missing in .env.local");

  const files = walk(SOURCE_DIR);
  console.log(`Found ${files.length} files to upload.`);

  const urls: Record<string, string> = {};
  let i = 0;
  for (const file of files) {
    const pathname = relative(SOURCE_DIR, file);
    const body = readFileSync(file);
    const blob = await put(pathname, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      token,
    });
    urls[pathname] = blob.url;
    i += 1;
    console.log(`[${i}/${files.length}] ${pathname} → ${blob.url}`);
  }

  writeFileSync("scripts/blob-urls.json", JSON.stringify(urls, null, 2));
  console.log(`\nDone. Mapping saved to scripts/blob-urls.json.`);

  const baseUrl = new URL(Object.values(urls)[0]).origin;
  console.log(`\nBlob base URL: ${baseUrl}`);
  console.log(`Add to next-app/.env.local and Vercel env vars:`);
  console.log(`  NEXT_PUBLIC_BLOB_BASE_URL="${baseUrl}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

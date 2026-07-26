// Backup logic al bazei Postgres (Supabase) în fișiere JSON — un fișier/tabel +
// DDL-ul coloanelor (_schema.json) și un manifest cu numărul de rânduri.
//
// Rulează:
//   node scripts/backup-db.mjs                          # ia DATABASE_URL din .env.local, folder cu dată
//   node scripts/backup-db.mjs <DATABASE_URL> <out_dir> [schema]
//
// Notă: era scris pe driverul Neon (@neondatabase/serverless); după migrarea pe
// Supabase folosește `pg`. Schema se autodetectează (`ericcosulea`, altfel `public`).
import pg from "pg";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function urlFromEnvFile() {
  try {
    const txt = readFileSync(resolve(here, "../.env.local"), "utf8");
    const m = txt.match(/^DATABASE_URL=(.*)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

function defaultOutDir() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return resolve(here, `../../db-backups/supabase-ericcosulea-${stamp}`);
}

const url = process.argv[2] || urlFromEnvFile();
const outDir = process.argv[3] || defaultOutDir();
let schema = process.argv[4] || null;

if (!url) {
  console.error("Lipsește DATABASE_URL (nici argument, nici în .env.local).");
  console.error("Usage: node scripts/backup-db.mjs [DATABASE_URL] [out_dir] [schema]");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
  statement_timeout: 300_000,
});
await client.connect();

// Schema: argument, altfel `ericcosulea` dacă există, altfel `public`.
if (!schema) {
  const r = await client.query(
    `SELECT nspname FROM pg_namespace WHERE nspname IN ('ericcosulea','public') ORDER BY nspname='ericcosulea' DESC LIMIT 1`,
  );
  schema = r.rows[0]?.nspname ?? "public";
}

mkdirSync(outDir, { recursive: true });

const tables = (
  await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename`,
    [schema],
  )
).rows.map((r) => r.tablename);

if (tables.length === 0) {
  console.error(`Nicio tabelă în schema "${schema}" — verifică URL-ul/schema.`);
  await client.end();
  process.exit(1);
}

// DDL coloanelor (tip, nullable, default) pentru fiecare tabel.
const columns = await client.query(
  `SELECT table_name, column_name, data_type, is_nullable, column_default, ordinal_position
     FROM information_schema.columns
    WHERE table_schema=$1
    ORDER BY table_name, ordinal_position`,
  [schema],
);
writeFileSync(`${outDir}/_schema.json`, JSON.stringify(columns.rows, null, 2));

const manifest = {
  takenAt: new Date().toISOString(),
  url: url.replace(/:[^:@]+@/, ":***@"),
  schema,
  tables: {},
};
let total = 0;

console.log(`Backup din schema "${schema}" → ${outDir}\n`);
for (const t of tables) {
  const { rows } = await client.query(`SELECT * FROM "${schema}"."${t}"`);
  writeFileSync(`${outDir}/${t}.json`, JSON.stringify(rows, null, 2));
  manifest.tables[t] = rows.length;
  total += rows.length;
  console.log(`  ${t}: ${rows.length} rânduri`);
}

manifest.totalRows = total;
writeFileSync(`${outDir}/_manifest.json`, JSON.stringify(manifest, null, 2));
await client.end();

console.log(`\n✓ Backup complet: ${tables.length} tabele, ${total} rânduri → ${outDir}`);

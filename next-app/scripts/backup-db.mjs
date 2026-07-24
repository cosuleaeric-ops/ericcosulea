// Backup logic al unei baze Neon/Postgres în fișiere JSON (un fișier/tabel) +
// DDL-ul coloanelor. Restaurabil cu restore-db.mjs. Rulează:
//   node scripts/backup-db.mjs <DATABASE_URL> <out_dir>
import { neon } from "@neondatabase/serverless";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.argv[2];
const outDir = process.argv[3];
if (!url || !outDir) {
  console.error("Usage: node scripts/backup-db.mjs <DATABASE_URL> <out_dir>");
  process.exit(1);
}

const sql = neon(url);
mkdirSync(outDir, { recursive: true });

const tables = (
  await sql`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
).map((r) => r.tablename);

// DDL coloanelor (tip, nullable, default) pentru fiecare tabel.
const columns = await sql`
  SELECT table_name, column_name, data_type, is_nullable, column_default,
         ordinal_position
  FROM information_schema.columns
  WHERE table_schema='public'
  ORDER BY table_name, ordinal_position`;
writeFileSync(`${outDir}/_schema.json`, JSON.stringify(columns, null, 2));

const manifest = { takenAt: new Date().toISOString(), url: url.replace(/:[^:@]+@/, ":***@"), tables: {} };
let total = 0;
for (const t of tables) {
  const rows = await sql.query(`SELECT * FROM "${t}"`);
  writeFileSync(`${outDir}/${t}.json`, JSON.stringify(rows, null, 2));
  manifest.tables[t] = rows.length;
  total += rows.length;
  console.log(`  ${t}: ${rows.length} rânduri`);
}
manifest.totalRows = total;
writeFileSync(`${outDir}/_manifest.json`, JSON.stringify(manifest, null, 2));
console.log(`\n✓ Backup complet: ${tables.length} tabele, ${total} rânduri → ${outDir}`);

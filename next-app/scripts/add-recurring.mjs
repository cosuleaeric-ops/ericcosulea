// Adaugă reguli recurente în Elite Deux direct în DB (state->'recurring').
// Append atomic prin `||`, ca să nu suprascrie restul blob-ului dacă aplicația
// salvează în același timp. Fără argumente = doar citește și afișează.
//
//   node scripts/add-recurring.mjs            # inspectează (dry-run)
//   node scripts/add-recurring.mjs --write    # scrie regulile din RULES
import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function urlFromEnvFile() {
  const txt = readFileSync(resolve(here, "../.env.local"), "utf8");
  const m = txt.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL lipsește din .env.local");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const uid = () => Math.random().toString(36).slice(2, 10);

const RULES = [
  {
    id: uid(),
    text: "Fă P&L Cursuri la Pahar",
    everyN: 1,
    unit: "month",
    startDate: "2026-07-15",
    materialized: [],
  },
  {
    id: uid(),
    text: "Fă P&L Cursuri la Pahar",
    everyN: 1,
    unit: "month",
    startDate: "2026-07-30",
    materialized: [],
  },
];

const write = process.argv.includes("--write");
const client = new pg.Client({ connectionString: urlFromEnvFile() });
await client.connect();

const { rows } = await client.query(
  `SELECT state->'recurring' AS recurring, state->>'lastSeenDate' AS last_seen
     FROM elite_deux_state WHERE id = 1`,
);

if (rows.length === 0) {
  console.error("Nu există rândul id=1 în elite_deux_state. Nu scriu nimic.");
  await client.end();
  process.exit(1);
}

const existing = Array.isArray(rows[0].recurring) ? rows[0].recurring : [];
const missing = RULES.filter(
  (rule) =>
    !existing.some(
      (current) =>
        current.text === rule.text &&
        current.everyN === rule.everyN &&
        current.unit === rule.unit &&
        current.startDate === rule.startDate,
    ),
);
console.log(`lastSeenDate: ${rows[0].last_seen}`);
console.log(`Reguli recurente existente: ${existing.length}`);
existing.forEach((r) => console.log(`  - ${r.text} (la ${r.everyN} ${r.unit}, din ${r.startDate})`));

if (!write) {
  console.log("\nDry-run. Aș adăuga:");
  missing.forEach((r) => console.log(`  + ${r.text} (la ${r.everyN} ${r.unit}, din ${r.startDate})`));
  await client.end();
  process.exit(0);
}

if (missing.length === 0) {
  console.log("\nToate regulile există deja. Nu scriu nimic.");
  await client.end();
  process.exit(0);
}

// Backup al blob-ului întreg înainte de scriere.
const full = await client.query(`SELECT state FROM elite_deux_state WHERE id = 1`);
const backupPath =
  process.env.BACKUP_PATH || resolve(here, "../../data/elite-deux-state.backup.json");
writeFileSync(backupPath, JSON.stringify(full.rows[0].state, null, 2));
console.log(`\nBackup scris în ${backupPath}`);

const now = Date.now();

const result = await client.query(
  `UPDATE elite_deux_state
      SET state = jsonb_set(
            jsonb_set(
              jsonb_set(
                state,
                '{recurring}',
                COALESCE(state->'recurring', '[]'::jsonb) || $1::jsonb
              ),
              '{recurringUpdatedAt}',
              to_jsonb($2::bigint)
            ),
            '{savedAt}',
            to_jsonb($2::bigint)
          ),
          updated_at = now()
    WHERE id = 1
    RETURNING jsonb_array_length(state->'recurring') AS total`,
  [JSON.stringify(missing), now],
);

console.log(`Scris. Reguli recurente acum: ${result.rows[0].total}`);
await client.end();

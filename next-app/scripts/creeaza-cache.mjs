// Creează tabelul de cache al dashboardului. De rulat o singură dată.
//   node scripts/creeaza-cache.mjs
import { readFileSync } from "node:fs"
import pg from "pg"
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const url = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1].trim().replace(/^["']|["']$/g, "")
const c = new pg.Client({ connectionString: url })
await c.connect()
await c.query(`CREATE TABLE IF NOT EXISTS ericcosulea.analytics_cache (
  cheie text PRIMARY KEY, date jsonb NOT NULL, expira timestamptz NOT NULL)`)
// Fără index pe `expira`: pe poolerul de tranzacții (6543) comanda a rămas
// blocată (21 aug 2026), iar tabelul are zeci de rânduri, nu milioane — căutarea
// se face oricum pe cheia primară.
const r = await c.query(`SELECT count(*)::int n FROM ericcosulea.analytics_cache`)
console.log(`Tabel gata. Rânduri: ${r.rows[0].n}`)
await c.end()

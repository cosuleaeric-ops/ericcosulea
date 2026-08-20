// Mută istoricul EliteData (Supabase) în PostHog, cu timestampurile lui reale.
//
// De ce: după trecerea pe PostHog, dashboardul arăta doar de la data migrării
// încolo. Cei 114.281 de evenimente strânși din martie 2023 rămăseseră într-o
// bază pe care nu-i mai citea nimeni.
//
// Dublarea e împiedicată în DOUĂ feluri, fiindcă sunt două riscuri diferite:
//   1. Rularea de două ori a scriptului → `uuid` determinist din id-ul din
//      Supabase (namespace fix), deci PostHog vede același eveniment, nu unul nou.
//   2. Perioada în care AMBELE sisteme au colectat (outglow din 5 iul, restul
//      câteva ore pe 20 aug) → marcajul `$lib: elitedata-import`. Interogările
//      din lib/analytics/posthog.ts iau, înainte de GRANITA, DOAR evenimentele
//      importate, iar după ea doar pe cele native. Vezi `unde()` acolo.
//
//   node scripts/import-elitedata-in-posthog.mjs --dry            # doar numără
//   node scripts/import-elitedata-in-posthog.mjs --limit=200      # test mic
//   node scripts/import-elitedata-in-posthog.mjs                  # tot
import { readFileSync } from "node:fs"
import crypto from "node:crypto"
import pg from "pg"

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
const v = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim().replace(/^["']|["']$/g, "")

// Cheia publică e a proiectului PostHog, aceeași pentru toate site-urile. În
// .env.local-ul blogului nu e (există doar în Vercel), deci o acceptăm și din
// mediu: POSTHOG_KEY=phc_... node scripts/import-elitedata-in-posthog.mjs
const KEY = process.env.POSTHOG_KEY || v("NEXT_PUBLIC_POSTHOG_KEY")
if (!KEY) { console.error("✖ Lipsește cheia: pune POSTHOG_KEY=phc_... în mediu"); process.exit(1) }
const DRY = process.argv.includes("--dry")
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) || null
const LOT = 500

// Numele de țară: istoricul ține codul ISO („RO"), PostHog ține numele întreg
// („Romania"). Fără conversie, dashboardul ar arăta „RO" și „Romania" ca două
// rânduri diferite pentru aceeași țară.
const numeTara = new Intl.DisplayNames(["en"], { type: "region" })
const tara = (cod) => { try { return cod ? numeTara.of(cod) : null } catch { return cod } }

// Județele: PostHog scrie „Sibiu County", „Bucharest". Pentru restul lumii nu
// avem tabel, deci rămâne codul brut — mai bine ceva decât gol.
const JUDETE = { AB: "Alba County", AR: "Arad County", AG: "Arges County", BC: "Bacau County",
  BH: "Bihor County", BN: "Bistrita-Nasaud County", BT: "Botosani County", BV: "Brasov County",
  BR: "Braila County", B: "Bucharest", BZ: "Buzau County", CS: "Caras-Severin County",
  CL: "Calarasi County", CJ: "Cluj County", CT: "Constanta County", CV: "Covasna County",
  DB: "Dambovita County", DJ: "Dolj County", GL: "Galati County", GR: "Giurgiu County",
  GJ: "Gorj County", HR: "Harghita County", HD: "Hunedoara County", IL: "Ialomita County",
  IS: "Iasi County", IF: "Ilfov County", MM: "Maramures County", MH: "Mehedinti County",
  MS: "Mures County", NT: "Neamt County", OT: "Olt County", PH: "Prahova County",
  SM: "Satu Mare County", SJ: "Salaj County", SB: "Sibiu County", SV: "Suceava County",
  TR: "Teleorman County", TM: "Timis County", TL: "Tulcea County", VS: "Vaslui County",
  VL: "Valcea County", VN: "Vrancea County" }
const judet = (codTara, cod) => (!cod ? null : codTara === "RO" ? JUDETE[cod] ?? cod : cod)

// Device: la noi „mobile", la PostHog „Mobile".
const DEVICE = { mobile: "Mobile", desktop: "Desktop", tablet: "Tablet" }

// uuid v5-like, determinist: același rând din Supabase ⇒ același uuid mereu.
const NS = "elitedata-import-2026"
const uuidPentru = (id) => {
  const h = crypto.createHash("sha1").update(`${NS}:${id}`).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}

const numeEveniment = (r) =>
  r.type === "pageview" ? "$pageview"
  : r.type === "leave" ? "$pageleave"
  : r.name || r.type

function gazdaReferrer(raw) {
  if (!raw) return null
  try { return new URL(raw).hostname.replace(/^www\./, "") } catch { return null }
}

function mapeaza(r) {
  const host = r.hostname || null
  const codTara = r.country || null
  return {
    event: numeEveniment(r),
    distinct_id: r.visitor_id,
    timestamp: new Date(r.created_at).toISOString(),
    uuid: uuidPentru(r.id),
    properties: {
      $session_id: r.session_id,
      $host: host,
      $pathname: r.path,
      $current_url: host && r.path ? `https://${host}${r.path}` : null,
      $referrer: r.referrer_raw,
      $referring_domain: gazdaReferrer(r.referrer_raw),
      utm_source: r.utm_source,
      utm_medium: r.utm_medium,
      utm_campaign: r.utm_campaign,
      $geoip_country_code: codTara,
      $geoip_country_name: tara(codTara),
      $geoip_subdivision_1_code: r.region,
      $geoip_subdivision_1_name: judet(codTara, r.region),
      $geoip_city_name: r.city,
      $browser: r.browser,
      $os: r.os,
      $device_type: DEVICE[r.device] ?? r.device,
      // Marcajul după care interogările despart istoricul de datele native.
      $lib: "elitedata-import",
      elitedata_id: r.id,
    },
  }
}

async function trimite(lot) {
  for (let incercare = 1; ; incercare++) {
    const res = await fetch("https://eu.i.posthog.com/batch/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `historical_migration` spune PostHog că timestampurile sunt din trecut
      // intenționat, ca să nu le trateze ca sosiri în timp real.
      body: JSON.stringify({ api_key: KEY, historical_migration: true, batch: lot }),
    })
    if (res.ok) return
    const text = await res.text().catch(() => "")
    if (incercare >= 4) throw new Error(`PostHog ${res.status}: ${text.slice(0, 200)}`)
    console.log(`  ↻ ${res.status}, reîncerc peste ${incercare * 5}s`)
    await new Promise((r) => setTimeout(r, incercare * 5000))
  }
}

const c = new pg.Client({ connectionString: v("DATABASE_URL") })
await c.connect()

const { rows: total } = await c.query(`SELECT count(*)::int n FROM ericcosulea.events`)
console.log(`Istoric EliteData: ${total[0].n} evenimente`)
if (DRY) { await c.end(); console.log("(--dry: nu trimit nimic)"); process.exit(0) }

const t0 = Date.now()
let trimise = 0
let ultimulId = 0
const plafon = LIMIT ?? Infinity

while (trimise < plafon) {
  const { rows } = await c.query(
    `SELECT * FROM ericcosulea.events WHERE id > $1 ORDER BY id ASC LIMIT $2`,
    [ultimulId, Math.min(LOT, plafon - trimise)],
  )
  if (!rows.length) break
  ultimulId = rows[rows.length - 1].id
  await trimite(rows.map(mapeaza))
  trimise += rows.length
  if (trimise % 5000 === 0 || rows.length < LOT) {
    const s = (Date.now() - t0) / 1000
    console.log(`  ${trimise}/${total[0].n} · ${Math.round(trimise / s)}/s · ${Math.round(s)}s`)
  }
}

await c.end()
console.log(`\n✓ ${trimise} evenimente trimise în ${Math.round((Date.now() - t0) / 1000)}s`)
console.log("PostHog le procesează asincron; apar în interogări în câteva minute.")

import "server-only";
import { cheieCache, citeste, scrie, durata, reimprospateaza } from "./cache";
import {
  type Range,
  type Granularity,
  bucketStarts,
  formatBucketLabel,
  previousRange,
} from "./range";
import type {
  Breakdowns,
  BreakdownRow,
  Filters,
  GoalRow,
  JourneyRow,
  Kpis,
  SeriesPoint,
  UserRow,
} from "./queries";

// ─────────────────────────────── PostHog ca sursă ───────────────────────────────
// Dashboard-ul rămâne al nostru; datele vin din PostHog (decizie 20 aug 2026).
// Interogările sunt HogQL — ClickHouse SQL peste tabelul `events` al proiectului.
//
// Un singur proiect PostHog pentru toate site-urile (atât dă planul gratuit),
// deci FIECARE interogare filtrează pe `properties.$host`. Fără filtrul ăsta,
// cifrele unui site le-ar include pe ale celorlalte.

const HOST = "https://eu.posthog.com";
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "215963";

export function posthogConfigurat(): boolean {
  return Boolean(process.env.POSTHOG_PERSONAL_API_KEY);
}

/**
 * Rezultatele interogărilor, ținute puțin în memoria instanței.
 *
 * De ce e nevoie: după ce istoricul EliteData (114.281 de evenimente) a intrat
 * în PostHog, aceleași interogări au trecut de la ~1s la 3-4s — ClickHouse are
 * pur și simplu mai mult de scanat. Dar datele de ieri nu se mai schimbă, iar
 * dashboardul reinterogă tot setul la fiecare încărcare de pagină, la fiecare
 * schimbare de perioadă și la fiecare pas înapoi în istoricul browserului.
 *
 * Cache-ul e per instanță, deci o instanță rece tot plătește prețul întreg.
 * Rezolvă navigarea repetată, nu prima vizită.
 */
const CACHE_MS = 60_000;
const cache = new Map<string, { la: number; date: unknown[] }>();

function dinCache<T>(cheie: string): T[] | null {
  const gasit = cache.get(cheie);
  if (!gasit) return null;
  if (Date.now() - gasit.la > CACHE_MS) {
    cache.delete(cheie);
    return null;
  }
  return gasit.date as T[];
}

async function hogql<T = unknown[]>(query: string, cacheabil = true): Promise<T[]> {
  if (cacheabil) {
    const gata = dinCache<T>(query);
    if (gata) return gata;
  }
  const inceput = Date.now();
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}`,
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`PostHog ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { results?: T[] };
  // Prima linie a interogării e destul ca s-o recunoști în loguri.
  // Prima linie e adesea doar „SELECT" — inutil când vrei să știi CARE interogare
  // a ținut pagina. Lipim liniile până strângem destule caractere ca să fie clar.
  const eticheta = query
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .slice(0, 70);
  console.log(`[posthog] ${Date.now() - inceput}ms · ${eticheta}`);
  const rezultate = json.results ?? [];
  if (cacheabil) {
    // Plafon simplu, ca o instanță de lungă durată să nu crească la nesfârșit:
    // cheile sunt interogări întregi, iar filtrele le fac practic nelimitate.
    if (cache.size > 200) cache.clear();
    cache.set(query, { la: Date.now(), date: rezultate });
  }
  return rezultate;
}

/** Literal SQL: apostroful se dublează, ca la orice ClickHouse. */
function lit(v: string): string {
  return `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

function iso(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "");
}

/** Hosturile unui site: și cu www, și fără — sunt același site. */
function hosturi(domeniu: string): string {
  const gol = domeniu.replace(/^www\./, "");
  return `(${[gol, `www.${gol}`].map(lit).join(", ")})`;
}

// Coloanele PostHog care corespund dimensiunilor noastre.
// PostHog dă domeniul brut al referrerului ($referring_domain), noi afișam
// numele sursei (Google, Facebook…). Normalizarea de mai jos reproduce exact
// etichetele vechi, ca rândurile din dashboard să arate la fel ca înainte.
const SURSA = `multiIf(
  toString(properties.$referring_domain) IN ('', '$direct'), 'Direct/None',
  toString(properties.$referring_domain) LIKE '%google.%', 'Google',
  toString(properties.$referring_domain) LIKE '%bing.%', 'Bing',
  toString(properties.$referring_domain) LIKE '%duckduckgo.%', 'DuckDuckGo',
  toString(properties.$referring_domain) LIKE '%yahoo.%', 'Yahoo',
  toString(properties.$referring_domain) LIKE '%ecosia.%', 'Ecosia',
  toString(properties.$referring_domain) LIKE '%yandex.%', 'Yandex',
  toString(properties.$referring_domain) LIKE '%facebook.%', 'Facebook',
  toString(properties.$referring_domain) LIKE '%instagram.%', 'Instagram',
  toString(properties.$referring_domain) IN ('t.co', 'x.com', 'twitter.com'), 'Twitter/X',
  toString(properties.$referring_domain) LIKE '%linkedin.%', 'LinkedIn',
  toString(properties.$referring_domain) LIKE '%reddit.%', 'Reddit',
  toString(properties.$referring_domain) LIKE '%youtube.%', 'YouTube',
  toString(properties.$referring_domain) LIKE '%tiktok.%', 'TikTok',
  toString(properties.$referring_domain) LIKE '%pinterest.%', 'Pinterest',
  toString(properties.$referring_domain) LIKE '%t.me', 'Telegram',
  toString(properties.$referring_domain)
)`;

// Canalul, cu ACEEAȘI regulă ca varianta pe Postgres (vezi CHANNEL_CASE din
// istoricul lui queries.ts): întâi utm_medium, apoi sursa.
const CANAL = `multiIf(
  position(lower(toString(properties.utm_medium)), 'cpc') > 0
    OR position(lower(toString(properties.utm_medium)), 'ppc') > 0
    OR position(lower(toString(properties.utm_medium)), 'paid') > 0, 'Paid Search',
  position(lower(toString(properties.utm_medium)), 'email') > 0, 'Email',
  position(lower(toString(properties.utm_medium)), 'social') > 0, 'Social',
  ${SURSA} = 'Direct/None', 'Direct',
  ${SURSA} IN ('Google','Bing','Yahoo','DuckDuckGo','Ecosia','Yandex','Baidu'), 'Organic Search',
  ${SURSA} IN ('Facebook','Instagram','Twitter/X','LinkedIn','Reddit','YouTube','TikTok','Pinterest','Telegram'), 'Social',
  'Referral'
)`;

const DIM: Record<string, string> = {
  channel: CANAL,
  referrer: SURSA,
  campaign: "toString(properties.utm_campaign)",
  path: "toString(properties.$pathname)",
  page: "toString(properties.$pathname)",
  hostname: "toString(properties.$host)",
  country: "toString(properties.$geoip_country_name)",
  region: "toString(properties.$geoip_subdivision_1_name)",
  city: "toString(properties.$geoip_city_name)",
  browser: "toString(properties.$browser)",
  os: "toString(properties.$os)",
  device: "toString(properties.$device_type)",
};

/** Filtrele din bara de sus, traduse în condiții HogQL. */
/**
 * Momentul în care EliteData a încetat să colecteze: ultimul eveniment din
 * `ericcosulea.events` (20 aug 2026, 17:39 ora României).
 *
 * Istoricul EliteData a fost mutat în PostHog cu timestampurile lui reale (vezi
 * scripts/import-elitedata-in-posthog.mjs), iar în perioada de dinainte AMBELE
 * sisteme au colectat pe alocuri — outglow din 5 iulie, restul câteva ore pe 20
 * august. Fără despărțire, aceiași vizitatori ar fi numărați de două ori, cu
 * identificatori diferiți, deci nici măcar deduplicabili.
 *
 * Regula: înainte de graniță contează DOAR evenimentele importate, după ea doar
 * cele native. O singură sursă pentru orice moment din timp.
 */
const GRANITA_ELITEDATA = "2026-08-20T14:39:15.331Z";
const MARCAJ_IMPORT = "elitedata-import";
const SURSA_UNICA =
  `((timestamp < toDateTime(${lit(GRANITA_ELITEDATA)}) AND properties.$lib = ${lit(MARCAJ_IMPORT)})` +
  ` OR (timestamp >= toDateTime(${lit(GRANITA_ELITEDATA)}) AND properties.$lib != ${lit(MARCAJ_IMPORT)}))`;

function unde(domeniu: string, range: Range, filters: Filters): string {
  const bucati = [
    `properties.$host IN ${hosturi(domeniu)}`,
    `timestamp >= toDateTime(${lit(iso(range.from))})`,
    `timestamp < toDateTime(${lit(iso(range.to))})`,
    SURSA_UNICA,
  ];
  for (const [cheie, val] of Object.entries(filters)) {
    if (!val || !DIM[cheie]) continue;
    bucati.push(`${DIM[cheie]} = ${lit(val)}`);
  }
  return bucati.join(" AND ");
}

const PAGEVIEW = `event = '$pageview'`;

// ───────────────────────────────── KPI ─────────────────────────────────
async function kpiuri(
  domeniu: string,
  range: Range,
  filters: Filters,
  kpiGoalName: string | null,
): Promise<Kpis> {
  const w = unde(domeniu, range, filters);
  const goal = kpiGoalName ? `countIf(event = ${lit(kpiGoalName)})` : "0";

  // Bounce și durata se citesc pe sesiune, deci întâi agregăm sesiunile, apoi
  // le numărăm. „Bounce" = o sesiune cu o singură vizionare de pagină.
  const [r] = await hogql<[number, number, number, number, number, number]>(`
    SELECT
      uniq(person_id) AS vizitatori,
      uniq($session_id) AS sesiuni,
      countIf(${PAGEVIEW}) AS vizionari,
      ${goal} AS conversii,
      (SELECT count() FROM (
        SELECT $session_id FROM events WHERE ${w} AND ${PAGEVIEW}
        GROUP BY $session_id HAVING count() <= 1
      )) AS bounced,
      (SELECT sum(durata) FROM (
        SELECT dateDiff('second', min(timestamp), max(timestamp)) AS durata
        FROM events WHERE ${w} GROUP BY $session_id
      )) AS durata_totala
    FROM events WHERE ${w}
  `);

  const [vizitatori, sesiuni, vizionari, conversii, bounced, durataTotala] = r ?? [
    0, 0, 0, 0, 0, 0,
  ];
  const convVizitatori = kpiGoalName
    ? await unicPeGoal(domeniu, range, filters, kpiGoalName)
    : 0;

  return {
    visitors: Number(vizitatori) || 0,
    sessions: Number(sesiuni) || 0,
    pageviews: Number(vizionari) || 0,
    bounceRate: sesiuni ? (Number(bounced) / Number(sesiuni)) * 100 : 0,
    sessionTime: sesiuni ? Number(durataTotala) / Number(sesiuni) : 0,
    conversions: convVizitatori,
    conversionRate: vizitatori ? (convVizitatori / Number(vizitatori)) * 100 : 0,
    kpi1Name: kpiGoalName,
    kpi1Value: kpiGoalName ? Number(conversii) || 0 : null,
  };
}

/** Vizitatori DISTINCȚI care au făcut conversia — nu numărul de conversii. */
async function unicPeGoal(
  domeniu: string,
  range: Range,
  filters: Filters,
  goalName: string,
): Promise<number> {
  const [r] = await hogql<[number]>(`
    SELECT uniq(person_id) FROM events
    WHERE ${unde(domeniu, range, filters)} AND event = ${lit(goalName)}
  `);
  return Number(r?.[0]) || 0;
}

// ─────────────────────────── Serie temporală ───────────────────────────
async function serie(
  domeniu: string,
  range: Range,
  granularity: Granularity,
  tz: string,
  filters: Filters,
  kpiGoalName: string | null,
): Promise<SeriesPoint[]> {
  const starts = bucketStarts(range, granularity);
  const unitate = granularity === "hourly" ? "hour" : granularity === "monthly" ? "month" : "day";
  const goal = kpiGoalName ? `uniqIf(person_id, event = ${lit(kpiGoalName)})` : "0";

  const randuri = await hogql<[string, number, number]>(`
    SELECT
      formatDateTime(dateTrunc(${lit(unitate)}, toTimeZone(timestamp, ${lit(tz)})), '%Y-%m-%dT%H:%i:%S') AS bucket,
      uniq(person_id) AS vizitatori,
      ${goal} AS conversii
    FROM events WHERE ${unde(domeniu, range, filters)}
    GROUP BY bucket ORDER BY bucket
  `);

  const peBucket = new Map(randuri.map((r) => [String(r[0]).slice(0, 13), r]));
  return starts.map((d) => {
    // Potrivim pe „YYYY-MM-DDTHH" în fusul cerut, ca la varianta pe Postgres.
    const cheie = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 13);
    const r = peBucket.get(cheie);
    return {
      t: d.toISOString(),
      label: formatBucketLabel(d, granularity, tz),
      value: r ? Number(r[1]) || 0 : 0,
      goalValue: r ? Number(r[2]) || 0 : 0,
    };
  });
}

// ───────────────────────────── Breakdown-uri ─────────────────────────────
const DIMENSIUNI = [
  "channel",
  "referrer",
  "campaign",
  "page",
  "hostname",
  "country",
  "region",
  "city",
  "browser",
  "os",
  "device",
] as const;

/**
 * TOATE breakdown-urile într-o singură interogare, cu UNION ALL.
 *
 * Erau unsprezece cereri separate. Rulau în paralel, deci nu se adunau la
 * așteptare, dar fiecare plătea handshake-ul, autentificarea și planificarea la
 * PostHog — și unsprezece cereri pe încărcare intră mult mai repede în plafonul
 * de 1.200/oră decât una singură.
 */
async function toateBreakdownurile(
  domeniu: string,
  range: Range,
  filters: Filters,
): Promise<Record<string, BreakdownRow[]>> {
  const w = unde(domeniu, range, filters);
  // O SINGURĂ scanare a evenimentelor, nu una per dimensiune.
  //
  // Cu `UNION ALL` erau unsprezece ramuri, deci ClickHouse citea eventurile de
  // unsprezece ori pentru aceeași fereastră de timp: 2.652ms măsurați pe 21 aug
  // 2026, adică interogarea care ținea tot dashboardul în loc. `arrayJoin`
  // desface fiecare eveniment în cele unsprezece perechi (dimensiune, valoare)
  // dintr-o singură citire, iar `LIMIT 100 BY dim` taie top-100 per dimensiune
  // fără subinterogări.
  //
  // `LIMIT` final e OBLIGATORIU: PostHog pune 100 implicit peste rezultatul
  // întreg, nu per dimensiune. Fără el, dimensiunile de la coada alfabetului se
  // taie tăcut — `region` a scăzut de la 21 de rânduri la 2 exact așa, fiindcă
  // suma celorlalte ajunsese la 100.
  const perechi = DIMENSIUNI.map((d) => `tuple(${lit(d)}, ${DIM[d]})`).join(",\n      ");
  const randuri = await hogql<[string, string, number]>(`
    SELECT p.1 AS dim, p.2 AS cheie, uniq(person_id) AS val
    FROM (
      SELECT person_id, arrayJoin([
      ${perechi}
      ]) AS p
      FROM events WHERE ${w}
    )
    WHERE p.2 != ''
    GROUP BY dim, cheie
    ORDER BY dim ASC, val DESC, cheie ASC
    LIMIT 100 BY dim
    LIMIT ${DIMENSIUNI.length * 100}`);

  const rezultat: Record<string, BreakdownRow[]> = {};
  for (const d of DIMENSIUNI) rezultat[d] = [];
  for (const r of randuri) {
    (rezultat[String(r[0])] ??= []).push({ key: String(r[1]), value: Number(r[2]) || 0 });
  }
  // UNION ALL nu garantează ordinea între ramuri, deci sortăm la loc.
  for (const d of DIMENSIUNI) rezultat[d].sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  return rezultat;
}

/** Prima și ultima pagină a fiecărei sesiuni, într-o singură trecere. */
async function intrareIesire(
  domeniu: string,
  range: Range,
  filters: Filters,
): Promise<{ entry: BreakdownRow[]; exit: BreakdownRow[] }> {
  const w = `${unde(domeniu, range, filters)} AND ${PAGEVIEW}`;
  const randuri = await hogql<[string, string, number]>(`
    SELECT 'entry' AS tip, prima AS cale, count() AS val FROM (
      SELECT argMin(toString(properties.$pathname), timestamp) AS prima,
             argMax(toString(properties.$pathname), timestamp) AS ultima
      FROM events WHERE ${w} GROUP BY $session_id
    ) WHERE prima != '' GROUP BY cale ORDER BY val DESC LIMIT 100
    UNION ALL
    SELECT 'exit' AS tip, ultima AS cale, count() AS val FROM (
      SELECT argMin(toString(properties.$pathname), timestamp) AS prima,
             argMax(toString(properties.$pathname), timestamp) AS ultima
      FROM events WHERE ${w} GROUP BY $session_id
    ) WHERE ultima != '' GROUP BY cale ORDER BY val DESC LIMIT 100
  `);

  const entry: BreakdownRow[] = [];
  const exit: BreakdownRow[] = [];
  for (const r of randuri) {
    const rand = { key: String(r[1]), value: Number(r[2]) || 0 };
    (String(r[0]) === "entry" ? entry : exit).push(rand);
  }
  const desc = (a: BreakdownRow, b: BreakdownRow) => b.value - a.value || a.key.localeCompare(b.key);
  return { entry: entry.sort(desc), exit: exit.sort(desc) };
}

// ──────────────────────────────── Goaluri ────────────────────────────────
// Un „goal" e un nume de eveniment din PostHog. Evenimentele lui interne
// ($pageview, $autocapture, $pageleave…) nu sunt goaluri, deci ies din listă.
const EVENIMENTE_INTERNE = [
  "$pageview",
  "$pageleave",
  "$autocapture",
  "$web_vitals",
  "$rageclick",
  "$identify",
  "$set",
  "$groupidentify",
  "$exception",
  "$feature_flag_called",
];

// `rate` se completează în getStatsPosthog, după ce se știe numărul de
// vizitatori — altfel interogarea asta ar trebui să aștepte KPI-urile.
async function goaluri(
  domeniu: string,
  range: Range,
  filters: Filters,
): Promise<(GoalRow & { unici: number })[]> {
  const excluse = EVENIMENTE_INTERNE.map(lit).join(", ");
  const randuri = await hogql<[string, number, number]>(`
    SELECT event, count() AS total, uniq(person_id) AS unici
    FROM events WHERE ${unde(domeniu, range, filters)} AND event NOT IN (${excluse})
    GROUP BY event ORDER BY total DESC LIMIT 50
  `);
  return randuri.map((r) => ({
    name: String(r[0]),
    displayName: String(r[0]),
    count: Number(r[1]) || 0,
    unici: Number(r[2]) || 0,
    rate: 0,
  }));
}

// ───────────────────────── Vizitatori și parcursuri ─────────────────────────
async function utilizatori(
  domeniu: string,
  range: Range,
  filters: Filters,
): Promise<UserRow[]> {
  const randuri = await hogql<
    [string, string, string, string, string, string, number, number, number, string]
  >(`
    SELECT
      toString(person_id) AS id,
      argMax(toString(properties.$geoip_country_name), timestamp) AS tara,
      argMax(toString(properties.$device_type), timestamp) AS device,
      argMax(toString(properties.$os), timestamp) AS os,
      argMax(toString(properties.$browser), timestamp) AS browser,
      argMin(${SURSA}, timestamp) AS referrer,
      uniq($session_id) AS sesiuni,
      countIf(${PAGEVIEW}) AS vizionari,
      dateDiff('second', min(timestamp), max(timestamp)) AS durata,
      formatDateTime(max(timestamp), '%Y-%m-%dT%H:%i:%SZ') AS ultima
    FROM events WHERE ${unde(domeniu, range, filters)}
    GROUP BY person_id ORDER BY max(timestamp) DESC LIMIT 100
  `);
  return randuri.map((r) => ({
    id: String(r[0]),
    country: String(r[1]) || null,
    device: String(r[2]) || null,
    os: String(r[3]) || null,
    browser: String(r[4]) || null,
    referrerSource: String(r[5]) || "Direct/None",
    sessions: Number(r[6]) || 0,
    pageviews: Number(r[7]) || 0,
    duration: Number(r[8]) || 0,
    lastSeen: String(r[9]),
  }));
}

async function parcursuri(
  domeniu: string,
  range: Range,
  filters: Filters,
): Promise<JourneyRow[]> {
  const randuri = await hogql<[string, string, string, string, string[]]>(`
    SELECT
      toString($session_id) AS id,
      argMax(toString(properties.$geoip_country_name), timestamp) AS tara,
      argMax(toString(properties.$device_type), timestamp) AS device,
      formatDateTime(min(timestamp), '%Y-%m-%dT%H:%i:%SZ') AS inceput,
      arrayMap(x -> x.2, arraySort(x -> x.1, groupArray((timestamp, toString(properties.$pathname))))) AS pagini
    FROM events WHERE ${unde(domeniu, range, filters)} AND ${PAGEVIEW}
    GROUP BY $session_id ORDER BY min(timestamp) DESC LIMIT 50
  `);
  return randuri.map((r) => ({
    id: String(r[0]),
    country: String(r[1]) || null,
    device: String(r[2]) || null,
    startedAt: String(r[3]),
    pages: (r[4] ?? []).map(String).filter(Boolean),
  }));
}

// ─────────────────────────────── Online acum ───────────────────────────────
export async function getOnlinePosthog(domeniu: string): Promise<number> {
  const [r] = await hogql<[number]>(
    `
    SELECT uniq(person_id) FROM events
    WHERE properties.$host IN ${hosturi(domeniu)}
      AND timestamp > now() - INTERVAL 5 MINUTE
      AND ${SURSA_UNICA}
  `,
    false, // modul live reîmprospătează la 10s; un cache de 60s ar minți
  );
  return Number(r?.[0]) || 0;
}

// ─────────────────────────── Intrarea principală ───────────────────────────
export async function getStatsPosthog(opts: {
  domeniu: string;
  kpiGoalName: string | null;
  tz: string;
  range: Range;
  granularity: Granularity;
  compare: boolean;
  filters: Filters;
}) {
  const { domeniu, kpiGoalName, tz, range, granularity, compare, filters } = opts;
  const prev = previousRange(range);

  // Rezultatul întreg, luat din cache dacă e proaspăt. „Online acum" NU intră
  // niciodată în cache: se cere separat, mai jos, la fiecare încărcare.
  // Marginile perioadei se rotunjesc la minut ÎN CHEIE. Fără asta, `range.to`
  // e momentul curent, deci se schimbă la fiecare milisecundă: fiecare cerere
  // ar scrie un rând nou și n-ar nimeri niciodată vreunul. Exact așa a picat
  // prima variantă (21 aug 2026): cache-ul se umplea și nu servea nimic.
  const laMinut = (d: Date) => Math.floor(d.getTime() / 60_000);
  const cheie = cheieCache([
    "stats-v1", domeniu, kpiGoalName, tz, granularity, compare, filters,
    laMinut(range.from), laMinut(range.to),
  ]);
  const dinCache = await citeste<Record<string, unknown>>(cheie);
  if (dinCache) {
    // Rezultatul expirat se servește oricum, iar reîmprospătarea se face în
    // fundal: te uiți la cifre de acum câteva minute în loc să aștepți 5
    // secunde ecranul gol, iar următoarea încărcare le are proaspete.
    if (dinCache.expirat) {
      reimprospateaza(cheie, async () => {
        const proaspat = await calculeaza();
        await scrie(cheie, proaspat, durata(range.to));
      });
    }
    return { ...dinCache.date, online: await getOnlinePosthog(domeniu) } as never;
  }

  // Un singur val de cereri: breakdown-urile sunt deja unite, iar goalurile,
  // vizitatorii și parcursurile nu mai așteaptă KPI-urile degeaba (aveau nevoie
  // doar de numărul de vizitatori, pentru rata de conversie — se aplică la
  // final, în JS).
  async function calculeaza() {
  // „Online acum" NU e aici: nu se cachează niciodată, deci se cere separat,
  // în paralel cu tot blocul ăsta.
  const [cur, anterior, puncte, punctePrev, entryExit, bd, goaleBrute, useri, journeys] =
    await Promise.all([
      kpiuri(domeniu, range, filters, kpiGoalName),
      kpiuri(domeniu, prev, filters, kpiGoalName),
      serie(domeniu, range, granularity, tz, filters, kpiGoalName),
      compare
        ? serie(domeniu, prev, granularity, tz, filters, kpiGoalName)
        : Promise.resolve(null),
      intrareIesire(domeniu, range, filters),
      toateBreakdownurile(domeniu, range, filters),
      goaluri(domeniu, range, filters),
      utilizatori(domeniu, range, filters),
      parcursuri(domeniu, range, filters),
    ]);

  const breakdowns = bd as unknown as Breakdowns;
  breakdowns.entry = entryExit.entry;
  breakdowns.exit = entryExit.exit;

  const goale: GoalRow[] = goaleBrute.map((g) => ({
    ...g,
    rate: cur.visitors ? (g.unici / cur.visitors) * 100 : 0,
  }));

  return {
    kpis: cur,
    prev: anterior,
    series: puncte,
    compareSeries: punctePrev,
    breakdowns,
    goals: goale,
    users: useri,
    journeys,
  };
  }

  const [rezultat, online] = await Promise.all([calculeaza(), getOnlinePosthog(domeniu)]);

  // Scrierea nu blochează răspunsul: dacă baza e lentă sau pică, pagina a
  // plecat deja cu datele proaspete.
  void scrie(cheie, rezultat, durata(range.to));

  return { ...rezultat, online };
}

/** Vizitatori per site pentru pagina de ansamblu, într-o singură interogare. */
export async function getOverviewPosthog(
  domenii: string[],
  range: Range,
  granularity: Granularity,
  tz: string,
): Promise<Map<string, { visitors: number; spark: number[] }>> {
  const rezultat = new Map<string, { visitors: number; spark: number[] }>();
  if (!domenii.length) return rezultat;

  const starts = bucketStarts(range, granularity);
  const unitate = granularity === "hourly" ? "hour" : granularity === "monthly" ? "month" : "day";
  const toateHosturile = domenii
    .flatMap((d) => {
      const gol = d.replace(/^www\./, "");
      return [gol, `www.${gol}`];
    })
    .map(lit)
    .join(", ");

  const randuri = await hogql<[string, string, number]>(`
    SELECT
      replaceRegexpOne(toString(properties.$host), '^www\\\\.', '') AS domeniu,
      formatDateTime(dateTrunc(${lit(unitate)}, toTimeZone(timestamp, ${lit(tz)})), '%Y-%m-%dT%H:%i:%S') AS bucket,
      uniq(person_id) AS vizitatori
    FROM events
    WHERE properties.$host IN (${toateHosturile})
      AND timestamp >= toDateTime(${lit(iso(range.from))})
      AND timestamp < toDateTime(${lit(iso(range.to))})
      AND ${SURSA_UNICA}
    GROUP BY domeniu, bucket
  `);

  for (const d of domenii) {
    const gol = d.replace(/^www\./, "");
    const aleLui = randuri.filter((r) => String(r[0]) === gol);
    const peBucket = new Map(aleLui.map((r) => [String(r[1]).slice(0, 13), Number(r[2]) || 0]));
    const spark = starts.map((s) => {
      const cheie = new Date(s.getTime() - s.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 13);
      return peBucket.get(cheie) ?? 0;
    });
    rezultat.set(gol, {
      visitors: spark.reduce((a, b) => a + b, 0),
      spark,
    });
  }
  return rezultat;
}

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../lib/db/schema";
import { events, websites, goals, funnels, integrationsGsc } from "../lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

// ───────────────────────── helpers ─────────────────────────
const rand = (n: number) => Math.floor(Math.random() * n);
const randInt = (a: number, b: number) => a + rand(b - a + 1);
const choice = <T,>(arr: T[]): T => arr[rand(arr.length)];

function weighted<T>(pairs: Array<[T, number]>): T {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) {
    if ((r -= w) <= 0) return v;
  }
  return pairs[0][0];
}

// ───────────────────────── distribuții ─────────────────────────
const REFERRERS: Array<[{ source: string; raw: string | null; medium: string | null }, number]> = [
  [{ source: "Google", raw: "https://www.google.com/", medium: "organic" }, 54],
  [{ source: "Direct/None", raw: null, medium: null }, 22],
  [{ source: "Bing", raw: "https://www.bing.com/", medium: "organic" }, 6],
  [{ source: "Facebook", raw: "https://www.facebook.com/", medium: "social" }, 5],
  [{ source: "Instagram", raw: "https://l.instagram.com/", medium: "social" }, 4],
  [{ source: "DuckDuckGo", raw: "https://duckduckgo.com/", medium: "organic" }, 2],
  [{ source: "Yahoo", raw: "https://search.yahoo.com/", medium: "organic" }, 2],
  [{ source: "Reddit", raw: "https://www.reddit.com/", medium: "social" }, 2],
  [{ source: "LinkedIn", raw: "https://www.linkedin.com/", medium: "social" }, 1],
  [{ source: "YouTube", raw: "https://www.youtube.com/", medium: "social" }, 2],
];

type Geo = { country: string; region: string | null; city: string | null };
const GEOS: Array<[Geo, number]> = [
  [{ country: "RO", region: "Bucharest", city: "Bucharest" }, 30],
  [{ country: "RO", region: "Cluj", city: "Cluj-Napoca" }, 10],
  [{ country: "RO", region: "Iasi", city: "Iasi" }, 7],
  [{ country: "RO", region: "Timis", city: "Timisoara" }, 6],
  [{ country: "RO", region: "Constanta", city: "Constanta" }, 5],
  [{ country: "RO", region: "Brasov", city: "Brasov" }, 5],
  [{ country: "RO", region: "Dolj", city: "Craiova" }, 4],
  [{ country: "RO", region: "Sibiu", city: "Sibiu" }, 3],
  [{ country: "MD", region: "Chisinau", city: "Chisinau" }, 5],
  [{ country: "DE", region: "Berlin", city: "Berlin" }, 3],
  [{ country: "IT", region: "Lombardy", city: "Milan" }, 3],
  [{ country: "ES", region: "Madrid", city: "Madrid" }, 2],
  [{ country: "GB", region: "England", city: "London" }, 2],
  [{ country: "US", region: "New York", city: "New York" }, 2],
  [{ country: "FR", region: "Ile-de-France", city: "Paris" }, 1],
  [{ country: "IN", region: "Maharashtra", city: "Mumbai" }, 1],
  [{ country: "NL", region: "North Holland", city: "Amsterdam" }, 1],
  [{ country: "AT", region: "Vienna", city: "Vienna" }, 1],
];

function pickTech(): { device: "desktop" | "mobile" | "tablet"; os: string; browser: string } {
  const device = weighted<"desktop" | "mobile" | "tablet">([
    ["mobile", 62],
    ["desktop", 33],
    ["tablet", 5],
  ]);
  let os: string;
  if (device === "mobile") os = weighted([["Android", 68], ["iOS", 32]]);
  else if (device === "tablet") os = weighted([["iOS", 58], ["Android", 42]]);
  else os = weighted([["Windows", 64], ["macOS", 26], ["Linux", 10]]);

  let browser: string;
  if (os === "iOS") browser = weighted([["Safari", 78], ["Chrome", 22]]);
  else if (os === "Android") browser = weighted([["Chrome", 74], ["Samsung Internet", 18], ["Firefox", 8]]);
  else if (os === "macOS") browser = weighted([["Safari", 46], ["Chrome", 42], ["Firefox", 12]]);
  else browser = weighted([["Chrome", 62], ["Edge", 22], ["Firefox", 12], ["Opera", 4]]);

  return { device, os, browser };
}

// hour-of-day weights (business hours mai grele)
const HOUR_WEIGHTS: Array<[number, number]> = Array.from({ length: 24 }, (_, h) => {
  const w = h < 6 ? 1 : h < 9 ? 4 : h < 18 ? 9 : h < 23 ? 7 : 3;
  return [h, w] as [number, number];
});

// ───────────────────────── site configs ─────────────────────────
type SiteCfg = {
  publicId: string;
  domain: string;
  name: string;
  paths: string[];
  customEvents: Array<{ name: string; display: string; rate: number }>;
  lastWeek: number;
  older: number;
};

const SITES: SiteCfg[] = [
  {
    publicId: "dfid_cesai01",
    domain: "cesaicumpar.ro",
    name: "Cesaicumpar",
    paths: ["/", "/", "/", "/cadouri", "/cadouri-craciun", "/idei-cadouri-femei", "/idei-cadouri-barbati", "/blog", "/blog/ce-cadou-sa-iei", "/cadouri-aniversare", "/contact"],
    customEvents: [
      { name: "click_afiliat", display: "Click afiliat", rate: 0.16 },
      { name: "share_idee", display: "Share idee", rate: 0.06 },
      { name: "newsletter_signup", display: "Newsletter signup", rate: 0.03 },
    ],
    lastWeek: 170,
    older: 470,
  },
  {
    publicId: "dfid_eric001",
    domain: "ericcosulea.ro",
    name: "Eric Cosulea",
    paths: ["/", "/", "/blog", "/tools", "/dogu", "/de-ce", "/chatgpt", "/mai-2023", "/inspo"],
    customEvents: [
      { name: "faq_what_do_i_get", display: "FAQ: what do I get", rate: 0.05 },
      { name: "faq_need_shipfast", display: "FAQ: need ShipFast", rate: 0.04 },
      { name: "faq_tech_stack", display: "FAQ: tech stack", rate: 0.04 },
      { name: "cta_subscribe", display: "CTA subscribe", rate: 0.03 },
    ],
    lastWeek: 120,
    older: 330,
  },
  {
    publicId: "dfid_dogu001",
    domain: "dogu.ro",
    name: "Dogu Reviews",
    paths: ["/", "/", "/reviews", "/produs/glovo", "/produs/tazz", "/produs/bolt-food", "/despre"],
    customEvents: [
      { name: "click_review", display: "Click review", rate: 0.1 },
      { name: "filter_used", display: "Filter used", rate: 0.05 },
    ],
    lastWeek: 72,
    older: 165,
  },
];

const PAGEVIEW_COUNT: Array<[number, number]> = [
  [1, 55],
  [2, 25],
  [3, 13],
  [4, 7],
];

const UTM_CAMPAIGNS = ["spring_sale", "newsletter_iunie", "black_friday", "promo_cadouri"];

function dayStart(daysAgo: number): number {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime() - daysAgo * 86400000;
}

type EventRow = typeof events.$inferInsert;

async function seedSite(websiteId: number, cfg: SiteCfg) {
  const rows: EventRow[] = [];
  const visitorPool: string[] = [];

  function visitor(): string {
    // 15% revin vizitatori existenți
    if (visitorPool.length > 20 && Math.random() < 0.15) return choice(visitorPool);
    const v = randomUUID();
    visitorPool.push(v);
    return v;
  }

  const NOW = Date.now();

  function buildSession(startMs: number) {
    const ref = weighted(REFERRERS);
    const geo = weighted(GEOS);
    const tech = pickTech();
    const visitorId = visitor();
    const sessionId = randomUUID();
    const pvCount = weighted(PAGEVIEW_COUNT);

    // UTM ocazional
    let utmSource: string | null = null;
    let utmMedium: string | null = null;
    let utmCampaign: string | null = null;
    if (Math.random() < 0.08) {
      utmMedium = weighted([["email", 5], ["cpc", 3], ["social", 2]]);
      utmSource = utmMedium === "email" ? "newsletter" : utmMedium === "cpc" ? "google" : "facebook";
      utmCampaign = choice(UTM_CAMPAIGNS);
    }

    const willCustom = pvCount > 1 || Math.random() < 0.04;
    const customEvt =
      willCustom && cfg.customEvents.length
        ? cfg.customEvents.find((e) => Math.random() < e.rate) ?? null
        : null;

    const hasMultiple = pvCount > 1 || customEvt !== null;
    const isBounce = !hasMultiple;

    const base: Omit<EventRow, "type" | "name" | "path" | "createdAt" | "isBounce"> = {
      websiteId,
      hostname: cfg.domain,
      referrerRaw: ref.raw,
      referrerSource: ref.source,
      utmSource,
      utmMedium,
      utmCampaign,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      browser: tech.browser,
      os: tech.os,
      device: tech.device,
      visitorId,
      sessionId,
      durationSeconds: 0,
    };

    let t = startMs;
    // primul pageview adesea pe "/" sau o pagină de intrare
    let path = Math.random() < 0.6 ? "/" : choice(cfg.paths);
    for (let i = 0; i < pvCount; i++) {
      if (t > NOW) break; // nu generăm event-uri în viitor
      rows.push({
        ...base,
        type: "pageview",
        name: null,
        path,
        isBounce,
        createdAt: new Date(t),
      });
      t += randInt(12, 150) * 1000;
      path = choice(cfg.paths);
    }
    if (customEvt && t <= NOW) {
      rows.push({
        ...base,
        type: "custom",
        name: customEvt.name,
        path,
        isBounce: false,
        createdAt: new Date(t),
      });
    }
  }

  function spawn(daysAgo: number) {
    const start = dayStart(daysAgo);
    const hour = weighted(HOUR_WEIGHTS);
    let ms = start + hour * 3600000 + randInt(0, 59) * 60000 + randInt(0, 59) * 1000;
    // pentru ziua curentă, distribuie uniform doar în trecut (fără event-uri din viitor)
    if (ms > NOW) ms = start + Math.floor(Math.random() * (NOW - start));
    buildSession(ms);
  }

  for (let i = 0; i < cfg.lastWeek; i++) spawn(randInt(0, 6));
  for (let i = 0; i < cfg.older; i++) spawn(randInt(7, 29));

  // câțiva vizitatori "online" (ultimele ~4 min), 1 pageview fiecare
  const live = randInt(1, 5);
  for (let i = 0; i < live; i++) {
    const ref = weighted(REFERRERS);
    const geo = weighted(GEOS);
    const tech = pickTech();
    rows.push({
      websiteId,
      type: "pageview",
      name: null,
      path: choice(cfg.paths),
      hostname: cfg.domain,
      referrerRaw: ref.raw,
      referrerSource: ref.source,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      browser: tech.browser,
      os: tech.os,
      device: tech.device,
      visitorId: visitor(),
      sessionId: randomUUID(),
      isBounce: true,
      durationSeconds: 0,
      createdAt: new Date(NOW - randInt(20, 240) * 1000),
    });
  }

  // insert în batch-uri
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(events).values(rows.slice(i, i + 500));
  }
  return rows.length;
}

async function main() {
  console.log("Curăț tabelele de analytics...");
  await db.delete(events);
  await db.delete(goals);
  await db.delete(funnels);
  await db.delete(integrationsGsc);
  await db.delete(websites);

  let totalEvents = 0;
  for (const cfg of SITES) {
    const [site] = await db
      .insert(websites)
      .values({
        publicId: cfg.publicId,
        domain: cfg.domain,
        name: cfg.name,
        timezone: "Europe/Bucharest",
        faviconUrl: `https://www.google.com/s2/favicons?domain=${cfg.domain}&sz=64`,
        kpiGoalName: cfg.customEvents[0]?.name ?? null,
      })
      .returning({ id: websites.id });

    // goals = custom events promovate
    for (const e of cfg.customEvents) {
      await db.insert(goals).values({
        websiteId: site.id,
        name: e.name,
        displayName: e.display,
      });
    }

    const n = await seedSite(site.id, cfg);
    totalEvents += n;
    console.log(`  ${cfg.domain}: ${n} events`);
  }

  // un funnel demo pe primul site
  const [firstSite] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(eq(websites.publicId, SITES[0].publicId))
    .limit(1);
  if (firstSite) {
    await db.insert(funnels).values({
      websiteId: firstSite.id,
      name: "Cadou → Afiliat",
      steps: [
        { type: "path", value: "/" },
        { type: "path", value: "/cadouri" },
        { type: "goal", value: "click_afiliat" },
      ],
    });
  }

  console.log(`Gata. ${SITES.length} site-uri, ${totalEvents} events.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

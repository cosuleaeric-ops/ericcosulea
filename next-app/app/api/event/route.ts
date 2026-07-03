import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, websites } from "@/lib/db/schema";
import { parseUserAgent, referrerSource, parseUtm } from "@/lib/analytics/parse";

export const runtime = "nodejs";

const SESSION_WINDOW_MS = 30 * 60 * 1000;

// Boți/crawlere/monitoare/headless — ca DataFast/Plausible. Traficul lor nu intră în DB.
const BOT_UA =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|pinterest|bitlybot|nuzzel|vkshare|w3c_validator|redditbot|applebot|whatsapp|telegrambot|discordbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|semrush|ahrefs|mj12|dotbot|petalbot|headless|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|monitor|preview|prerender|python-requests|axios|curl|wget|okhttp|java\/|go-http|node-fetch|scrapy/i;

function isBot(ua: string | null): boolean {
  if (!ua) return true; // fără user-agent = aproape sigur bot/script
  return BOT_UA.test(ua);
}

// IP-uri excluse (ca DataFast Settings → Exclusions). CSV în env: "1.2.3.4, 5.6.7.8".
const EXCLUDED_IPS = new Set(
  (process.env.ANALYTICS_EXCLUDE_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function clientIp(h: Headers): string | null {
  const fwd = h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
}

// Path-uri excluse (ca DataFast Settings → Exclusions). Default /admin; override CSV în env.
// Fiecare intrare exclude atât path-ul exact, cât și subpaginile lui (ex. /admin/users).
const EXCLUDED_PATHS = (process.env.ANALYTICS_EXCLUDE_PATHS ?? "/admin")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type Payload = {
  id?: string; // website public id (dfid_xxxx)
  type?: "pageview" | "custom";
  name?: string;
  url?: string;
  referrer?: string;
  visitor_id?: string;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const publicId = body.id;
  const visitorId = body.visitor_id;
  if (!publicId || !visitorId) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  // Filtru boți + IP-uri excluse — respinge înainte de orice DB write (202, fără eroare la client).
  if (isBot(req.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  }
  if (EXCLUDED_IPS.size > 0) {
    const ip = clientIp(req.headers);
    if (ip && EXCLUDED_IPS.has(ip)) {
      return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
    }
  }

  // Lookup site — necunoscut → ignorăm silențios (nu stricăm clientul).
  const siteRows = await db
    .select({ id: websites.id, domain: websites.domain })
    .from(websites)
    .where(eq(websites.publicId, publicId))
    .limit(1);
  const site = siteRows[0];
  if (!site) {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  }

  // ── Derivă din URL ──
  let path = "/";
  let hostname = site.domain;
  try {
    const u = new URL(body.url ?? "");
    path = u.pathname || "/";
    hostname = u.hostname || site.domain;
  } catch {
    /* păstrăm default */
  }

  // Path exclus (ex. /admin) → nu contorizăm, drop înainte de sesiune/insert.
  if (isExcludedPath(path)) {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  }

  const refSource = referrerSource(body.referrer, site.domain);
  const utm = parseUtm(body.url);

  // ── Geo din headerele Vercel ──
  const h = req.headers;
  const country = h.get("x-vercel-ip-country") || null;
  const region = h.get("x-vercel-ip-country-region") || null;
  const city = decodeHeader(h.get("x-vercel-ip-city"));

  // ── User agent ──
  const { browser, os, device } = parseUserAgent(h.get("user-agent"));

  // ── Sesiune + bounce (fereastră de 30 min pe vizitator) ──
  const since = new Date(Date.now() - SESSION_WINDOW_MS);
  const recent = await db
    .select({ sessionId: events.sessionId })
    .from(events)
    .where(
      and(
        eq(events.websiteId, site.id),
        eq(events.visitorId, visitorId),
        gt(events.createdAt, since),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(1);

  let sessionId: string;
  let isBounce: boolean;
  if (recent[0]?.sessionId) {
    // Continuare de sesiune → nu mai e bounce.
    sessionId = recent[0].sessionId;
    isBounce = false;
    await db
      .update(events)
      .set({ isBounce: false })
      .where(and(eq(events.websiteId, site.id), eq(events.sessionId, sessionId)));
  } else {
    sessionId = randomUUID();
    isBounce = true;
  }

  await db.insert(events).values({
    websiteId: site.id,
    type: body.type === "custom" ? "custom" : "pageview",
    name: body.type === "custom" ? body.name ?? null : null,
    path,
    hostname,
    referrerRaw: body.referrer || null,
    referrerSource: refSource,
    utmSource: utm.utmSource,
    utmMedium: utm.utmMedium,
    utmCampaign: utm.utmCampaign,
    country,
    region,
    city,
    browser,
    os,
    device,
    visitorId,
    sessionId,
    isBounce,
  });

  return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
}

function decodeHeader(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { eventHeaderProbe, events, websites } from "@/lib/db/schema";
import { createHash } from "crypto";
import { parseUserAgent, referrerSource, parseUtm } from "@/lib/analytics/parse";
import { isDatacenterIp } from "@/lib/analytics/datacenter";
import { clientIp, excludedIps } from "@/lib/analytics/exclusions";

export const runtime = "nodejs";

const SESSION_WINDOW_MS = 30 * 60 * 1000;

// Boți/crawlere/monitoare/headless — ca DataFast/Plausible. Traficul lor nu intră în DB.
const BOT_UA =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|pinterest|bitlybot|nuzzel|vkshare|w3c_validator|redditbot|applebot|whatsapp|telegrambot|discordbot|googlebot|bingbot|yandex|duckduckbot|baiduspider|semrush|ahrefs|mj12|dotbot|petalbot|headless|phantomjs|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|statuscake|monitor|preview|prerender|python-requests|axios|curl|wget|okhttp|java\/|go-http|node-fetch|scrapy/i;

function isBot(ua: string | null): boolean {
  if (!ua) return true; // fără user-agent = aproape sigur bot/script
  return BOT_UA.test(ua);
}

// Boți cu UA spoofat: UA-ul zice Chrome modern, dar headerele nu sunt de
// Chromium real. Orice Chromium ≥89 trimite sec-ch-ua pe fiecare request
// (inclusiv sendBeacon); clienții HTTP care doar copiază UA-ul nu-l au.
function isSpoofedChromium(h: Headers): boolean {
  const chua = h.get("sec-ch-ua");
  if (chua && /headless/i.test(chua)) return true;
  const m = (h.get("user-agent") ?? "").match(/Chrome\/(\d+)/);
  if (m && Number(m[1]) >= 89 && !chua) return true;
  if (!h.get("accept-language")) return true; // browserele reale îl trimit mereu
  return false;
}

// IP-uri excluse (ca DataFast Settings → Exclusions). CSV în env: "1.2.3.4, 5.6.7.8".
// Peste ele se adaugă IP-urile mele, ținute în DB (vezi lib/analytics/exclusions.ts).
const ENV_EXCLUDED_IPS = new Set(
  (process.env.ANALYTICS_EXCLUDE_IPS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

// Path-uri excluse (ca DataFast Settings → Exclusions). Default /admin; override CSV în env.
// Fiecare intrare exclude atât path-ul exact, cât și subpaginile lui (ex. /admin/users).
const EXCLUDED_PATHS = (process.env.ANALYTICS_EXCLUDE_PATHS ?? "/admin")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isExcludedPath(path: string): boolean {
  return EXCLUDED_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

// Headerele salvate de probă (vezi event_header_probe în schema). Doar cele care
// separă un browser real de un client HTTP care copiază UA-ul.
const PROBE_HEADERS = [
  "user-agent",
  "accept",
  "accept-language",
  "accept-encoding",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "content-type",
  "origin",
  "referer",
  "priority",
  "connection",
];

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
  type?: "pageview" | "custom" | "leave";
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

  // Admin logat = noi înșine. Cookie-ul hint (SameSite=None) e trimis de browser
  // și cross-site, deci ne excludem pe TOATE site-urile, nu doar ericcosulea.ro.
  if (req.cookies.get("ericcosulea_admin_hint")?.value === "1") {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  }

  // Filtru boți + IP-uri excluse — respinge înainte de orice DB write (202, fără eroare la client).
  if (isBot(req.headers.get("user-agent"))) {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  }
  const ip = clientIp(req.headers);
  if (ip && (ENV_EXCLUDED_IPS.has(ip) || (await excludedIps()).has(ip))) {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  }

  // Boți cu UA curat (headless cu stealth, fleet-uri cu proxy rezidențial):
  // headere care nu bat cu UA-ul, profilul desktop-pe-Linux (datele pe 30 zile:
  // 100% vizitatori single-hit, ~2 vizite reale RO/lună; regula era doar pe
  // Chrome, iar pe 9 aug 2026 fleet-ul a mutat pe Edge/Linux, 37 vizitatori
  // într-o oră după 14 zile cu zero) sau IP de datacenter.
  // Se aruncă ÎNAINTE de orice query: picurau non-stop și țineau Neon-ul
  // treaz 24/7, iar compute-ul pe planul free e limitat. Istoricul marcat
  // is_datacenter rămâne filtrat de view-ul events_human.
  const { browser, os, device } = parseUserAgent(req.headers.get("user-agent"));
  if (
    isSpoofedChromium(req.headers) ||
    (os === "Linux" && device === "desktop") ||
    (await isDatacenterIp(ip))
  ) {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
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

  const isLeave = body.type === "leave";

  let sessionId: string;
  let isBounce: boolean;
  if (recent[0]?.sessionId) {
    sessionId = recent[0].sessionId;
    isBounce = false;
    if (!isLeave) {
      // Continuare de sesiune → nu mai e bounce. Leave nu e engagement, nu flip-uim.
      await db
        .update(events)
        .set({ isBounce: false })
        .where(and(eq(events.websiteId, site.id), eq(events.sessionId, sessionId)));
    }
  } else if (isLeave) {
    // Leave fără sesiune activă (ex. tab redeschis după 30 min) — nu porni o
    // sesiune nouă doar dintr-un leave, ar umfla numărul de sesiuni.
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  } else {
    sessionId = randomUUID();
    isBounce = true;
  }

  await db.insert(events).values({
    websiteId: site.id,
    type: body.type === "custom" ? "custom" : isLeave ? "leave" : "pageview",
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

  // Probă de headere pe pageview-urile care au trecut filtrele. Nu blochează
  // răspunsul și nu-l poate strica: orice eroare se înghite.
  if (!isLeave) {
    const probe: Record<string, string> = {};
    for (const name of PROBE_HEADERS) {
      const v = h.get(name);
      if (v !== null) probe[name] = v;
    }
    // Prezența (nu doar valorile) separă clienții HTTP de browsere.
    probe._present = [...h.keys()].sort().join(",");
    await db
      .insert(eventHeaderProbe)
      .values({
        websiteId: site.id,
        visitorId,
        path,
        country,
        city,
        ipHash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 16) : null,
        headers: probe,
      })
      .catch(() => {});
  }

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

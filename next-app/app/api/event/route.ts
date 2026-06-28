import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, websites } from "@/lib/db/schema";
import { parseUserAgent, referrerSource, parseUtm } from "@/lib/analytics/parse";

export const runtime = "nodejs";

const SESSION_WINDOW_MS = 30 * 60 * 1000;

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

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { crawlerEvents, websites } from "@/lib/db/schema";
import { detectCrawler } from "@/lib/analytics/crawlers";

export const runtime = "nodejs";

// Colector server-side pentru crawlere AI. Site-urile trimit un POST de aici
// (middleware) când user-agentul e crawler — ele nu execută JS, deci /api/event
// nu le vede niciodată. Rezolvă site-ul după `id` (dfid_xxxx) sau după `domain`.
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
  domain?: string; // alternativ, hostname-ul site-ului
  path?: string;
  ua?: string; // UA-ul crawlerului (forwardat, fiindcă fetch-ul server-side are alt UA)
  status?: number;
};

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const ua = body.ua ?? req.headers.get("user-agent");
  const hit = detectCrawler(ua);
  if (!hit) {
    // Nu e crawler cunoscut → nu contorizăm (202, fără eroare la client).
    return NextResponse.json({ ok: true, crawler: false }, { status: 202, headers: CORS });
  }

  // Rezolvă site-ul: preferă publicId, altfel domain (fără www).
  let siteId: number | undefined;
  if (body.id) {
    const rows = await db
      .select({ id: websites.id })
      .from(websites)
      .where(eq(websites.publicId, body.id))
      .limit(1);
    siteId = rows[0]?.id;
  } else if (body.domain) {
    const d = body.domain.replace(/^www\./, "").toLowerCase();
    const rows = await db
      .select({ id: websites.id })
      .from(websites)
      .where(eq(websites.domain, d))
      .limit(1);
    siteId = rows[0]?.id;
  }
  if (siteId === undefined) {
    return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
  }

  let path: string | null = body.path ?? null;
  if (path) {
    try {
      path = new URL(path, "https://x").pathname || "/";
    } catch {
      /* păstrăm valoarea brută */
    }
  }

  await db.insert(crawlerEvents).values({
    websiteId: siteId,
    crawler: hit.name,
    category: hit.category,
    path,
    status: typeof body.status === "number" ? body.status : null,
  });

  return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
}

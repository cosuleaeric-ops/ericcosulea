import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/lib/db";
import { integrationsGsc } from "@/lib/db/schema";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
import { listProperties, getIntegration } from "@/lib/analytics/gsc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const site = new URL(req.url).searchParams.get("site");
  if (!site) return NextResponse.json({ error: "Missing site" }, { status: 400 });
  const website = await getWebsiteByPublicId(site);
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const integ = await getIntegration(website.id);
  const properties = await listProperties(website.id);
  return NextResponse.json({
    connected: !!integ?.refreshToken,
    email: integ?.googleEmail ?? null,
    selected: integ?.gscSiteUrl ?? null,
    properties,
  });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: { site?: string; siteUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (!body.site || !body.siteUrl) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const website = await getWebsiteByPublicId(body.site);
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db
    .update(integrationsGsc)
    .set({ gscSiteUrl: body.siteUrl })
    .where(eq(integrationsGsc.websiteId, website.id));
  return NextResponse.json({ ok: true });
}

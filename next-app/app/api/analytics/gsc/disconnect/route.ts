import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/lib/db";
import { integrationsGsc } from "@/lib/db/schema";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: { site?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (!body.site) return NextResponse.json({ error: "Missing site" }, { status: 400 });
  const website = await getWebsiteByPublicId(body.site);
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(integrationsGsc).where(eq(integrationsGsc.websiteId, website.id));
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/lib/db";
import { goals } from "@/lib/db/schema";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: { site?: string; name?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  const name = body.name?.trim();
  if (!body.site || !name) {
    return NextResponse.json({ error: "Missing site or name" }, { status: 400 });
  }
  const website = await getWebsiteByPublicId(body.site);
  if (!website) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const existing = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.websiteId, website.id), eq(goals.name, name)))
    .limit(1);
  if (existing.length) {
    return NextResponse.json({ ok: true, existed: true });
  }

  await db.insert(goals).values({
    websiteId: website.id,
    name,
    displayName: body.displayName?.trim() || name,
  });
  return NextResponse.json({ ok: true });
}

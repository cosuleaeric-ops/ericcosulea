import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/lib/db";
import { goals, websites } from "@/lib/db/schema";
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

/**
 * Șterge definiția unui goal. Event-urile rămân în `events`: goal-ul e doar
 * numele promovat în panou, iar ștergerea lui nu poate rescrie istoricul. Îl
 * poți adăuga la loc oricând, cu aceleași cifre.
 *
 * Dacă goal-ul șters e cel promovat ca „#1 KPI", câmpul de pe site se golește
 * odată cu el — altfel cardul ar număra în continuare un goal care nu mai
 * există nicăieri în interfață.
 */
export async function DELETE(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: { site?: string; name?: string };
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

  await db
    .delete(goals)
    .where(and(eq(goals.websiteId, website.id), eq(goals.name, name)));

  if (website.kpiGoalName === name) {
    await db
      .update(websites)
      .set({ kpiGoalName: null })
      .where(eq(websites.id, website.id));
  }
  return NextResponse.json({ ok: true });
}

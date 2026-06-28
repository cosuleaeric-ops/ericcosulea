import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
import { getKeywords } from "@/lib/analytics/gsc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const p = new URL(req.url).searchParams;
  const site = p.get("site");
  const from = p.get("from");
  const to = p.get("to");
  if (!site || !from || !to) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const website = await getWebsiteByPublicId(site);
  if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const startDate = new Date(from).toISOString().slice(0, 10);
  const endDate = new Date(to).toISOString().slice(0, 10);
  const path = p.get("path") || undefined;

  const result = await getKeywords(website.id, startDate, endDate, path);
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
import { fetchDeploys, type Deploy } from "@/lib/analytics/vercel";
import { dayKeyInTz } from "@/lib/analytics/format";

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

  const deploys = await fetchDeploys(website.domain, from, to);
  if (!deploys) return NextResponse.json({ connected: false });

  const byDay: Record<string, Deploy[]> = {};
  for (const d of deploys) {
    const k = dayKeyInTz(d.ts, website.timezone);
    (byDay[k] ??= []).push(d);
  }
  return NextResponse.json({ connected: true, byDay });
}

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getWebsiteByPublicId, getCrawlerStats } from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const p = new URL(req.url).searchParams;
  const site = p.get("site");
  const fromStr = p.get("from");
  const toStr = p.get("to");
  if (!site || !fromStr || !toStr) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(+from) || isNaN(+to)) {
    return NextResponse.json({ error: "Bad dates" }, { status: 400 });
  }

  const website = await getWebsiteByPublicId(site);
  if (!website) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const stats = await getCrawlerStats(website.id, { from, to });
  return NextResponse.json(stats);
}

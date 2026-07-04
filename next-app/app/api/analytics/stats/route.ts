import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import {
  getWebsiteByPublicId,
  getStats,
  FILTER_KEYS,
  type Filters,
} from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const p = url.searchParams;
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

  const gParam = p.get("granularity");
  const granularity =
    gParam === "minute" || gParam === "hourly" || gParam === "monthly"
      ? gParam
      : "daily";
  const compare = p.get("compare") === "1";

  const filters: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = p.get(k);
    if (v) filters[k] = v;
  }

  const stats = await getStats({
    websiteId: website.id,
    publicId: site,
    kpiGoalName: website.kpiGoalName,
    tz: website.timezone,
    range: { from, to },
    granularity,
    compare,
    filters,
  });

  return NextResponse.json(stats);
}

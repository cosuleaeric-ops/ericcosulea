import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getOverview } from "@/lib/analytics/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const p = new URL(req.url).searchParams;
  const fromStr = p.get("from");
  const toStr = p.get("to");
  if (!fromStr || !toStr) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(+from) || isNaN(+to)) {
    return NextResponse.json({ error: "Bad dates" }, { status: 400 });
  }
  const granularity = p.get("granularity") === "hourly" ? "hourly" : "daily";

  const data = await getOverview({ from, to }, granularity);
  return NextResponse.json(data);
}

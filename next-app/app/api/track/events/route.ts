import { NextRequest, NextResponse } from "next/server";
import { getEmailEvents } from "@/lib/tracking/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-track-secret",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Timeline-ul unui email (deschideri + click-uri) pentru popup-ul din extensie.
// Auth prin secret partajat, la fel ca /status.
export async function GET(req: NextRequest) {
  const secret = process.env.TRACK_SECRET;
  if (!secret || req.headers.get("x-track-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400, headers: CORS });
  }
  const events = await getEmailEvents(id);
  return NextResponse.json({ events }, { headers: CORS });
}

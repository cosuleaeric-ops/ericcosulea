import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getTrackedEmails } from "@/lib/tracking/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const emails = await getTrackedEmails();
  return NextResponse.json({ emails });
}

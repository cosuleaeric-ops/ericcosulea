import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { getEmailEvents } from "@/lib/tracking/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const events = await getEmailEvents(id);
  return NextResponse.json({ events });
}

import { NextRequest, NextResponse } from "next/server";
import { getTrackedEmails, getRecentAlerts } from "@/lib/tracking/queries";

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

// Interogat de extensie (mail.google.com) ca să deseneze bifele + notificările „citit".
// Auth prin secret partajat (nu sesiune), la fel ca /register.
export async function GET(req: NextRequest) {
  const secret = process.env.TRACK_SECRET;
  if (!secret || req.headers.get("x-track-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: CORS });
  }

  const [all, alerts] = await Promise.all([getTrackedEmails(), getRecentAlerts()]);
  // Doar câmpurile de care are nevoie extensia (fără lista de linkuri).
  const emails = all.map((e) => ({
    id: e.id,
    account: e.account,
    recipient: e.recipient,
    subject: e.subject,
    threadId: e.threadId,
    createdAt: e.createdAt,
    opens: e.opens,
    clicks: e.clicks,
    lastOpenAt: e.lastOpenAt,
  }));

  return NextResponse.json({ emails, alerts }, { headers: CORS });
}

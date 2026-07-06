import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedEmails } from "@/lib/db/schema";
import { clientIp } from "@/lib/tracking/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-track-secret",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type Payload = {
  id?: string;
  account?: string;
  recipient?: string;
  subject?: string;
  threadId?: string;
  links?: string[];
};

// Extensia înregistrează aici emailul la trimitere: id + destinațiile reale ale linkurilor.
// Protejat cu secret partajat (nu sesiune) fiindcă apelul vine din mail.google.com.
export async function POST(req: NextRequest) {
  const secret = process.env.TRACK_SECRET;
  if (!secret || req.headers.get("x-track-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401, headers: CORS });
  }

  let body: Payload;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }

  const links = Array.isArray(body.links)
    ? body.links.filter((l): l is string => typeof l === "string")
    : [];

  await db
    .insert(trackedEmails)
    .values({
      id: body.id,
      account: body.account ?? null,
      recipient: body.recipient ?? null,
      subject: body.subject ?? null,
      threadId: body.threadId ?? null,
      links,
      senderIp: clientIp(req.headers),
    })
    .onConflictDoUpdate({
      target: trackedEmails.id,
      set: {
        account: body.account ?? null,
        recipient: body.recipient ?? null,
        subject: body.subject ?? null,
        threadId: body.threadId ?? null,
        links,
        senderIp: clientIp(req.headers),
      },
    });

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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

  const incoming = Array.isArray(body.links)
    ? body.links.filter((l): l is string => typeof l === "string")
    : [];

  // Re-register cu același id (draft redeschis / undo-send / re-send): extensia trimite ""
  // pe pozițiile linkurilor deja rescrise (nu le mai știe originalul) — le păstrăm pe cele
  // stocate; pozițiile non-goale (linkuri noi) suprascriu/extind. Altfel am pierde
  // destinațiile vechi și click-urile lor ar redirecta pe fallback.
  const prev = await db
    .select({ links: trackedEmails.links })
    .from(trackedEmails)
    .where(eq(trackedEmails.id, body.id))
    .limit(1);
  const prevLinks = prev[0]?.links ?? [];
  const links: string[] = [];
  for (let i = 0; i < Math.max(prevLinks.length, incoming.length); i++) {
    links.push(incoming[i] || prevLinks[i] || "");
  }

  // La re-register (draft/undo-send/re-send) extensia poate să NU mai știe unele câmpuri
  // (threadId lipsă din hash, subiect gol) — nu suprascriem valori bune cu null/"".
  const senderIp = clientIp(req.headers);
  const set: Record<string, unknown> = { links, senderIp };
  if (body.account) set.account = body.account;
  if (body.recipient) set.recipient = body.recipient;
  if (body.subject) set.subject = body.subject;
  if (body.threadId) set.threadId = body.threadId;

  await db
    .insert(trackedEmails)
    .values({
      id: body.id,
      account: body.account || null,
      recipient: body.recipient || null,
      subject: body.subject || null,
      threadId: body.threadId || null,
      links,
      senderIp,
    })
    .onConflictDoUpdate({
      target: trackedEmails.id,
      set,
    });

  return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailEvents, trackedEmails } from "@/lib/db/schema";

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

// Extensia raportează că PROPRIETARUL vede acum emailul (rulează în Gmail-ul lui).
// Marcăm timestamp-ul; /t/o suprimă deschiderile din fereastra următoare = propriile vizualizări.
export async function POST(req: NextRequest) {
  const secret = process.env.TRACK_SECRET;
  if (!secret || req.headers.get("x-track-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401, headers: CORS });
  }
  let id: string | undefined;
  try {
    id = JSON.parse(await req.text())?.id;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }
  if (!id) return NextResponse.json({ ok: false }, { status: 400, headers: CORS });

  await db.update(trackedEmails).set({ ownerSeenAt: new Date() }).where(eq(trackedEmails.id, id));

  // Cursă: pixelul se poate declanșa cu câteva secunde înainte ca extensia să raporteze.
  // Marcăm retroactiv deschiderile/click-urile din ultimele 45s ca proprii (excluse).
  await db
    .update(emailEvents)
    .set({ isBot: true })
    .where(
      and(
        eq(emailEvents.emailId, id),
        eq(emailEvents.isBot, false),
        gt(emailEvents.createdAt, sql`now() - interval '45 seconds'`),
      ),
    );

  return NextResponse.json({ ok: true }, { headers: CORS });
}

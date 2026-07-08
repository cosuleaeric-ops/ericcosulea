import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
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

// Extensia raportează că PROPRIETARUL vede acum emailul/emailurile (rulează în Gmail-ul lui).
// Marcăm timestamp-ul; /t/o și /t/c suprimă evenimentele din fereastra următoare = propriile vizualizări.
// Acceptă { ids: [...] } (batch, extensia curentă) sau { id } (compatibilitate).
export async function POST(req: NextRequest) {
  const secret = process.env.TRACK_SECRET;
  if (!secret || req.headers.get("x-track-secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401, headers: CORS });
  }
  let ids: string[];
  try {
    const body = JSON.parse(await req.text());
    ids = (Array.isArray(body?.ids) ? body.ids : [body?.id])
      .filter((x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 40)
      .slice(0, 100);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: CORS });
  }
  if (!ids.length) return NextResponse.json({ ok: false }, { status: 400, headers: CORS });

  const emails = await db
    .select({ senderIp: trackedEmails.senderIp })
    .from(trackedEmails)
    .where(inArray(trackedEmails.id, ids));
  const senderIps = [...new Set(emails.map((e) => e.senderIp).filter((x): x is string => !!x))];

  await db.update(trackedEmails).set({ ownerSeenAt: new Date() }).where(inArray(trackedEmails.id, ids));

  // Cursă: pixelul se poate declanșa cu câteva secunde înainte ca extensia să raporteze.
  // Marcăm retroactiv deschiderile/click-urile din ultimele 45s ca proprii (excluse) și
  // ANULĂM alerta — altfel un „high_count/reopen_week" declanșat de propria vizualizare
  // rămâne în events și extensia îl toastează deși open-ul a fost suprimat.
  // DOAR evenimentele care pot fi ale proprietarului (GoogleImageProxy sau IP-ul lui) —
  // un hit direct de pe IP străin e al destinatarului chiar dacă pică în fereastră.
  const ambiguous = or(
    sql`${emailEvents.userAgent} ~* 'googleimageproxy|ggpht\\.com'`,
    senderIps.length ? and(isNotNull(emailEvents.ip), inArray(emailEvents.ip, senderIps)) : sql`false`,
  );
  await db
    .update(emailEvents)
    .set({ isBot: true, alert: null })
    .where(
      and(
        inArray(emailEvents.emailId, ids),
        eq(emailEvents.isBot, false),
        gt(emailEvents.createdAt, sql`now() - interval '45 seconds'`),
        ambiguous,
      ),
    );

  return NextResponse.json({ ok: true }, { headers: CORS });
}

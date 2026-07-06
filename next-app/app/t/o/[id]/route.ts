import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailEvents, trackedEmails } from "@/lib/db/schema";
import { PIXEL, PIXEL_HEADERS, looksLikeBot, clientIp } from "@/lib/tracking/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fereastră de grație după trimitere: deschiderile din primul minut sunt aproape sigur
// prefetch (Gmail/GoogleImageProxy pre-încarcă și randează imaginile la primire), nu o
// citire umană reală. Un destinatar real deschide mult mai târziu, deci nu pierdem nimic.
const GRACE_MS = 60_000;

// Pixel de open tracking. URL: /t/o/{id}.gif (extensia îl injectează în email).
// Întotdeauna returnează GIF-ul (chiar dacă logarea eșuează) — un mail rupt e mai rău decât un open pierdut.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const emailId = raw.replace(/\.gif$/i, "");

  const ua = req.headers.get("user-agent");
  const ip = clientIp(req.headers);
  try {
    // Marcăm ca „propriu/prefetch" (exclus din total) dacă:
    //  - UA e scanner/bot cunoscut, SAU
    //  - IP-ul == IP-ul expeditorului (load din compose sau tu îți deschizi propriul mail), SAU
    //  - e în primele 15s de la trimitere (prefetch Gmail), SAU
    //  - emailul nu e încă înregistrat (pixelul s-a încărcat în compose, înainte de register).
    let excluded = looksLikeBot(ua);
    const rows = await db
      .select({ senderIp: trackedEmails.senderIp, createdAt: trackedEmails.createdAt })
      .from(trackedEmails)
      .where(eq(trackedEmails.id, emailId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      excluded = true;
    } else {
      if (row.senderIp && ip && row.senderIp === ip) excluded = true;
      if (Date.now() - new Date(row.createdAt).getTime() < GRACE_MS) excluded = true;
    }

    await db.insert(emailEvents).values({
      emailId,
      type: "open",
      userAgent: ua,
      ip,
      isBot: excluded,
    });
  } catch {
    /* nu stricăm imaginea dacă DB dă eroare */
  }

  return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
}

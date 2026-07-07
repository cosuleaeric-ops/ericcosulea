import { NextRequest, NextResponse } from "next/server";
import { and, count, eq, max } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailEvents, trackedEmails } from "@/lib/db/schema";
import { PIXEL, PIXEL_HEADERS, looksLikeBot, clientIp } from "@/lib/tracking/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fereastră de grație după trimitere: deschiderile din primul minut sunt aproape sigur
// prefetch (Gmail/GoogleImageProxy pre-încarcă și randează imaginile la primire), nu o
// citire umană reală. Un destinatar real deschide mult mai târziu, deci nu pierdem nimic.
const GRACE_MS = 60_000;
const OWNER_SEEN_MS = 30_000; // deschideri în 30s de când proprietarul a văzut emailul = propriile lui vizualizări
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HIGH_COUNT = 5; // prag „deschis de un nr anormal de ori"

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
      .select({
        senderIp: trackedEmails.senderIp,
        createdAt: trackedEmails.createdAt,
        ownerSeenAt: trackedEmails.ownerSeenAt,
      })
      .from(trackedEmails)
      .where(eq(trackedEmails.id, emailId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      excluded = true;
    } else {
      if (row.senderIp && ip && row.senderIp === ip) excluded = true;
      if (Date.now() - new Date(row.createdAt).getTime() < GRACE_MS) excluded = true;
      // Proprietarul se uita chiar acum la email (extensia a raportat) → propria vizualizare.
      if (row.ownerSeenAt && Date.now() - new Date(row.ownerSeenAt).getTime() < OWNER_SEEN_MS) {
        excluded = true;
      }
    }

    // Alerte notificabile — doar pe deschideri umane reale.
    let alert: string | null = null;
    if (!excluded) {
      const prior = await db
        .select({ c: count(), last: max(emailEvents.createdAt) })
        .from(emailEvents)
        .where(
          and(eq(emailEvents.emailId, emailId), eq(emailEvents.type, "open"), eq(emailEvents.isBot, false)),
        );
      const priorCount = Number(prior[0]?.c ?? 0);
      const last = prior[0]?.last ? new Date(prior[0].last) : null;
      const newCount = priorCount + 1;
      if (last && Date.now() - last.getTime() >= WEEK_MS) {
        alert = "reopen_week"; // redeschis la ≥7 zile de la deschiderea anterioară
      } else if (newCount === HIGH_COUNT) {
        alert = "high_count"; // a atins pragul de 5 deschideri
      }
    }

    await db.insert(emailEvents).values({
      emailId,
      type: "open",
      userAgent: ua,
      ip,
      isBot: excluded,
      alert,
    });
  } catch {
    /* nu stricăm imaginea dacă DB dă eroare */
  }

  return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
}

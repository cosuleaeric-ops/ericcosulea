import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailEvents, trackedEmails } from "@/lib/db/schema";
import { looksLikeBot, isGoogleProxy, clientIp } from "@/lib/tracking/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK = "https://ericcosulea.ro";
const GRACE_MS = 60_000; // click în primul minut de la trimitere = scaner (SafeLinks etc.)
const OWNER_SEEN_MS = 45_000; // click în 45s de când proprietarul vede emailul = al lui (aliniat cu /t/o, > re-ping 20s)

// Click tracking. URL: /t/c/{id}?l={idx}. Loghează click-ul și redirecționează la destinația reală.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: emailId } = await params;
  const idx = Number(req.nextUrl.searchParams.get("l"));

  const ua = req.headers.get("user-agent");
  const ip = clientIp(req.headers);
  let target = FALLBACK;
  let excluded = looksLikeBot(ua);

  try {
    // Caută destinația reală + datele de filtrare (register). Miss → fallback pe homepage, nu 404.
    const rows = await db
      .select({
        links: trackedEmails.links,
        senderIp: trackedEmails.senderIp,
        createdAt: trackedEmails.createdAt,
        ownerSeenAt: trackedEmails.ownerSeenAt,
      })
      .from(trackedEmails)
      .where(eq(trackedEmails.id, emailId))
      .limit(1);
    const row = rows[0];
    const url = row?.links?.[idx];
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      target = url;
    }
    if (!row) {
      excluded = true;
    } else {
      // Ferestrele pe timp DOAR pentru surse ambigue (proxy Google / IP-ul expeditorului) —
      // un click direct de pe IP străin cu UA normal e al destinatarului, nu se suprimă.
      const ownIp = !!(row.senderIp && ip && row.senderIp === ip);
      const ambiguous = ownIp || isGoogleProxy(ua);
      if (ownIp) excluded = true;
      if (ambiguous && Date.now() - new Date(row.createdAt).getTime() < GRACE_MS) excluded = true;
      if (ambiguous && row.ownerSeenAt && Date.now() - new Date(row.ownerSeenAt).getTime() < OWNER_SEEN_MS) {
        excluded = true; // proprietarul se uită acum → click propriu
      }
    }
  } catch {
    /* redirecționăm pe fallback dacă lookup-ul pică */
  }

  try {
    await db.insert(emailEvents).values({
      emailId,
      type: "click",
      linkIdx: Number.isInteger(idx) ? idx : null,
      linkUrl: target === FALLBACK ? null : target,
      userAgent: ua,
      ip,
      isBot: excluded,
    });
  } catch {
    /* redirecționăm oricum */
  }

  return NextResponse.redirect(target, 302);
}

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailEvents, trackedEmails } from "@/lib/db/schema";
import { looksLikeBot, clientIp } from "@/lib/tracking/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK = "https://ericcosulea.ro";

// Click tracking. URL: /t/c/{id}?l={idx}. Loghează click-ul și redirecționează la destinația reală.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: emailId } = await params;
  const idx = Number(req.nextUrl.searchParams.get("l"));

  // Caută destinația reală (stocată la register). Miss → fallback pe homepage, nu 404.
  let target = FALLBACK;
  try {
    const rows = await db
      .select({ links: trackedEmails.links })
      .from(trackedEmails)
      .where(eq(trackedEmails.id, emailId))
      .limit(1);
    const url = rows[0]?.links?.[idx];
    if (typeof url === "string" && /^https?:\/\//i.test(url)) {
      target = url;
    }
  } catch {
    /* redirecționăm pe fallback dacă lookup-ul pică */
  }

  const ua = req.headers.get("user-agent");
  try {
    await db.insert(emailEvents).values({
      emailId,
      type: "click",
      linkIdx: Number.isInteger(idx) ? idx : null,
      linkUrl: target === FALLBACK ? null : target,
      userAgent: ua,
      ip: clientIp(req.headers),
      isBot: looksLikeBot(ua),
    });
  } catch {
    /* redirecționăm oricum */
  }

  return NextResponse.redirect(target, 302);
}

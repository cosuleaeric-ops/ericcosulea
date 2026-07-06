import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailEvents } from "@/lib/db/schema";
import { PIXEL, PIXEL_HEADERS, looksLikeBot, clientIp } from "@/lib/tracking/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pixel de open tracking. URL: /t/o/{id}.gif (extensia îl injectează în email).
// Întotdeauna returnează GIF-ul (chiar dacă logarea eșuează) — un mail rupt e mai rău decât un open pierdut.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const emailId = raw.replace(/\.gif$/i, "");

  const ua = req.headers.get("user-agent");
  try {
    await db.insert(emailEvents).values({
      emailId,
      type: "open",
      userAgent: ua,
      ip: clientIp(req.headers),
      isBot: looksLikeBot(ua),
    });
  } catch {
    /* nu stricăm imaginea dacă DB dă eroare */
  }

  return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
}

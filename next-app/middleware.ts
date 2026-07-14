import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, syncAdminHintCookie, type Session } from "@/lib/session-config";
import { detectCrawler } from "@/lib/analytics/crawlers";

const PUBLIC_ELITE_DEUX_FILES = new Set([
  "/elite-deux/manifest.json",
  "/elite-deux/icon-192.png",
  "/elite-deux/icon-512.png",
  "/elite-deux/favicon.svg",
  "/elite-deux/sw.js",
  "/elite-deux/styles.css",
  "/elite-deux/app.js",
]);

// Paginile care cer autentificare (fostul matcher). Restul trec liber.
const PROTECTED_PREFIXES = [
  "/dogu",
  "/vanzaridogu",
  "/raportpnldogu",
  "/reviewsdogu",
  "/elite-deux",
  "/pnlpersonal",
];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Crawlere AI: self-tracking pentru ericcosulea.ro ──
  // Ele nu rulează JS (deci nu trec prin /api/event); le prindem aici după UA
  // și le raportăm la colector. Nu le trecem prin auth pe paginile publice.
  const crawler = detectCrawler(request.headers.get("user-agent"));
  if (crawler) {
    try {
      await fetch(new URL("/api/crawler", request.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain: request.nextUrl.hostname,
          path: pathname,
          ua: request.headers.get("user-agent"),
        }),
      });
    } catch {
      /* best-effort, nu blocăm requestul crawlerului */
    }
    if (!isProtected(pathname)) return NextResponse.next();
    // dacă un crawler cere o pagină protejată, cade în auth normal mai jos
  }

  // ── Pagini publice: fără gate de auth (comportament ca înainte) ──
  if (!isProtected(pathname)) return NextResponse.next();

  // ── Auth pe paginile protejate (neschimbat) ──
  if (PUBLIC_ELITE_DEUX_FILES.has(pathname)) return NextResponse.next();

  if (!sessionOptions.password) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const response = NextResponse.next();
  const session = await getIronSession<Session>(request, response, sessionOptions);

  if (!session.loggedInAt) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  syncAdminHintCookie(response, true);
  return response;
}

export const config = {
  // Rulează pe toate paginile (ca să prindem crawlerele), mai puțin API, asset-uri
  // Next și fișiere statice (orice conține un punct).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

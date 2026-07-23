import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, syncAdminHintCookie, type Session } from "@/lib/session-config";

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
// /admin, /brain și /elitedata sunt gate-uite AICI, nu doar în layout: în App
// Router pagina se randează concurent cu layout-ul, deci un scanner care
// lovește /admin pornea query-urile paginii în Neon deși primea redirect.
const PROTECTED_PREFIXES = [
  "/dogu",
  "/vanzaridogu",
  "/raportpnldogu",
  "/reviewsdogu",
  "/elite-deux",
  "/pnlpersonal",
  "/admin",
  "/brain",
  "/elitedata",
];

// Sub /admin, dar publice (altfel redirectul către login ar bucla).
const PUBLIC_ADMIN_PREFIXES = ["/admin/login"];

function isProtected(pathname: string): boolean {
  if (PUBLIC_ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return false;
  }
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Crawler tracking scos (iul 2026): crawlerele lovesc site-ul non-stop și
  // fiecare hit scria în Neon → compute-ul free nu adormea niciodată.

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

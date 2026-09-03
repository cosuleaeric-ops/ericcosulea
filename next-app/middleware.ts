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
const PUBLIC_ELITEDATA_FILES = new Set([
  "/elitedata/favicon.svg",
  "/assets/avatar.jpeg",
]);
const PUBLIC_SITE_FILES = new Set([
  "/assets/Logo3.png",
]);
const PUBLIC_TRACKING_PATHS = new Set([
  "/js/script.js",
  "/api/event",
]);
// Paginile care cer autentificare (fostul matcher). Restul trec liber.
// /admin și /elitedata sunt gate-uite AICI, nu doar în layout: în App
// Router pagina se randează concurent cu layout-ul, deci un scanner care
// lovește /admin pornea query-urile paginii în Neon deși primea redirect.
const PROTECTED_PREFIXES = [
  "/elite-deux",
  "/pnlpersonal",
  "/admin",
  "/elitedata",
];

// Sub /admin, dar publice (altfel redirectul către login ar bucla).
const PUBLIC_ADMIN_PREFIXES = ["/admin/login"];
const ADMIN_API_PREFIXES = [
  "/api/auth-status",
  "/api/brain",
  "/api/elite-deux",
  "/api/pnlpersonal",
  "/api/analytics",
  "/api/logout",
];

function hiddenPageResponse(): Response {
  return new Response(
    `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title></title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#b8b8b8;color:#000;font-family:system-ui,sans-serif}.flag{font-size:clamp(64px,16vw,180px);line-height:1}</style></head><body><div class="flag" aria-label="steag negru">🏴</div></body></html>`,
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function isAdminOnlyAllowed(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/elite-deux" ||
    pathname.startsWith("/elite-deux/") ||
    pathname === "/pnlpersonal" ||
    pathname.startsWith("/pnlpersonal/") ||
    pathname === "/elitedata" ||
    pathname.startsWith("/elitedata/") ||
    PUBLIC_SITE_FILES.has(pathname) ||
    PUBLIC_ELITEDATA_FILES.has(pathname) ||
    PUBLIC_TRACKING_PATHS.has(pathname) ||
    ADMIN_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next/")
  );
}

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

  // Temporar, site-ul public e ascuns complet. Rămâne accesibil doar panoul
  // /admin și infrastructura necesară ca el să funcționeze.
  if (!isAdminOnlyAllowed(pathname)) {
    return hiddenPageResponse();
  }

  // ── Pagini publice: fără gate de auth (comportament ca înainte) ──
  if (!isProtected(pathname)) return NextResponse.next();

  // ── Auth pe paginile protejate (neschimbat) ──
  if (PUBLIC_ELITE_DEUX_FILES.has(pathname) || PUBLIC_ELITEDATA_FILES.has(pathname)) {
    return NextResponse.next();
  }

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
  // Rulează pe toate cererile aplicației, mai puțin asset-urile generate de
  // Next. Fișierele din /public sunt acoperite aici și ascunse cu 404.
  matcher: ["/((?!_next/static|_next/image).*)"],
};

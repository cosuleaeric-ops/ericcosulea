import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { syncAdminHintCookie, type Session } from "@/lib/session";

const PUBLIC_ELITE_DEUX_FILES = new Set([
  "/elite-deux/manifest.json",
  "/elite-deux/icon-192.png",
  "/elite-deux/icon-512.png",
  "/elite-deux/favicon.svg",
  "/elite-deux/sw.js",
  "/elite-deux/styles.css",
  "/elite-deux/app.js",
]);

const PROTECTED_PREFIXES = [
  "/admin",
  "/dogu",
  "/vanzaridogu",
  "/raportpnldogu",
  "/reviewsdogu",
  "/elite-deux",
  "/pnlpersonal",
];

function isProtectedPath(pathname: string): boolean {
  if (pathname.startsWith("/admin/login")) return false;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin/login")) return NextResponse.next();
  if (PUBLIC_ELITE_DEUX_FILES.has(pathname)) return NextResponse.next();

  const password = process.env.SESSION_SECRET;
  const response = NextResponse.next();

  if (!password) {
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return response;
  }

  const session = await getIronSession<Session>(request, response, {
    password,
    cookieName: "ericcosulea_admin",
  });

  const loggedIn = Boolean(session.loggedInAt);
  syncAdminHintCookie(response, loggedIn);

  if (isProtectedPath(pathname) && !loggedIn) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/).*)",
  ],
};

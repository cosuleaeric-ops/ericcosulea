import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";

type Session = { loggedInAt?: number };

const PUBLIC_ELITE_DEUX_FILES = new Set([
  "/elite-deux/manifest.json",
  "/elite-deux/icon-192.png",
  "/elite-deux/icon-512.png",
  "/elite-deux/favicon.svg",
  "/elite-deux/sw.js",
  "/elite-deux/styles.css",
  "/elite-deux/app.js",
]);

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin/login")) return NextResponse.next();
  if (PUBLIC_ELITE_DEUX_FILES.has(request.nextUrl.pathname)) return NextResponse.next();

  const password = process.env.SESSION_SECRET;
  if (!password) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const response = NextResponse.next();
  const session = await getIronSession<Session>(request, response, {
    password,
    cookieName: "ericcosulea_admin",
  });
  if (!session.loggedInAt) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/dogu", "/dogu/:path*",
    "/vanzaridogu", "/vanzaridogu/:path*",
    "/raportpnldogu", "/raportpnldogu/:path*",
    "/reviewsdogu", "/reviewsdogu/:path*",
    "/elite-deux", "/elite-deux/:path*",
    "/pnlpersonal", "/pnlpersonal/:path*",
  ],
};

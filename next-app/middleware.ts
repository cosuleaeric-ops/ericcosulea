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
  "/elite-deux/fonts/LabGrotesque-Regular.woff2",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: [
    "/dogu",
    "/dogu/:path*",
    "/vanzaridogu",
    "/vanzaridogu/:path*",
    "/raportpnldogu",
    "/raportpnldogu/:path*",
    "/reviewsdogu",
    "/reviewsdogu/:path*",
    "/elite-deux",
    "/elite-deux/:path*",
    "/pnlpersonal",
    "/pnlpersonal/:path*",
  ],
};

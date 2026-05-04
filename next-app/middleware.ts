import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";

type Session = { loggedInAt?: number };

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

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
  matcher: ["/admin/:path*"],
};

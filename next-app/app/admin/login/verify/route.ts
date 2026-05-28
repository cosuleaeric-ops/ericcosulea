import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { consumeMagicToken } from "@/lib/auth";
import { sessionOptions, syncAdminHintCookie, type Session } from "@/lib/session";

function publicOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login?error=missing", publicOrigin(request)));
  }

  if (!sessionOptions.password) {
    return NextResponse.redirect(new URL("/admin/login?error=config", publicOrigin(request)));
  }

  const email = await consumeMagicToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", publicOrigin(request)));
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (email !== adminEmail) {
    return NextResponse.redirect(new URL("/admin/login?error=denied", publicOrigin(request)));
  }

  const response = NextResponse.redirect(new URL("/admin", publicOrigin(request)));
  const session = await getIronSession<Session>(request, response, sessionOptions);
  session.loggedInAt = Date.now();
  await session.save();
  syncAdminHintCookie(response, true);
  return response;
}

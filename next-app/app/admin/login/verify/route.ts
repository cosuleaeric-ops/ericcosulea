import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { consumeMagicToken } from "@/lib/auth";
import { sessionOptions, type Session } from "@/lib/session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/admin/login?error=missing", request.url));
  }

  const email = await consumeMagicToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/admin/login?error=invalid", request.url));
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (email !== adminEmail) {
    return NextResponse.redirect(new URL("/admin/login?error=denied", request.url));
  }

  const response = NextResponse.redirect(new URL("/admin", request.url));
  const session = await getIronSession<Session>(request, response, sessionOptions);
  session.loggedInAt = Date.now();
  await session.save();
  return response;
}

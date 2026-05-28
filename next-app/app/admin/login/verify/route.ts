import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { consumeMagicToken } from "@/lib/auth";
import { sessionOptions, setAdminHintCookie, type Session } from "@/lib/session";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    redirect("/admin/login?error=missing");
  }

  if (!sessionOptions.password) {
    redirect("/admin/login?error=config");
  }

  const email = await consumeMagicToken(token);
  if (!email) {
    redirect("/admin/login?error=invalid");
  }

  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (email !== adminEmail) {
    redirect("/admin/login?error=denied");
  }

  const session = await getIronSession<Session>(await cookies(), sessionOptions);
  session.loggedInAt = Date.now();
  await session.save();
  await setAdminHintCookie();

  redirect("/admin");
}

import { NextResponse } from "next/server";
import { getSession, syncAdminHintCookie } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  session.destroy();
  const response = NextResponse.json({ ok: true });
  syncAdminHintCookie(response, false);
  return response;
}

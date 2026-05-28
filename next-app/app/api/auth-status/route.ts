import { isAuthenticated, syncAdminHintCookie } from "@/lib/session";
import { NextResponse } from "next/server";

export async function GET() {
  const loggedIn = await isAuthenticated();
  const response = NextResponse.json({ loggedIn });
  syncAdminHintCookie(response, loggedIn);
  return response;
}

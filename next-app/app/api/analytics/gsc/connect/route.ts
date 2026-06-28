import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAuthenticated } from "@/lib/session";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
import { buildAuthUrl, gscConfigured } from "@/lib/analytics/gsc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const url = new URL(req.url);
  const site = url.searchParams.get("site");
  if (!site) {
    return NextResponse.json({ error: "Missing site" }, { status: 400 });
  }
  const website = await getWebsiteByPublicId(site);
  if (!website) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  if (!gscConfigured()) {
    return NextResponse.redirect(
      new URL(`/analytics/${site}/settings?gsc=not_configured`, req.url),
    );
  }

  const nonce = randomBytes(16).toString("hex");
  const state = Buffer.from(JSON.stringify({ site, nonce })).toString("base64url");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("gsc_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}

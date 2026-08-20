import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/lib/db";
import { integrationsGsc } from "@/lib/db/schema";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
import { exchangeCode, encrypt, getIntegration } from "@/lib/analytics/gsc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || !state) {
    return NextResponse.redirect(new URL(`/elitedata?gsc=error`, req.url));
  }

  let parsed: { site: string; nonce: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    return NextResponse.redirect(new URL(`/elitedata?gsc=error`, req.url));
  }

  const cookieNonce = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)gsc_oauth_nonce=([^;]+)/)?.[1];
  if (!cookieNonce || cookieNonce !== parsed.nonce) {
    return NextResponse.redirect(new URL(`/elitedata?gsc=csrf`, req.url));
  }

  const website = await getWebsiteByPublicId(parsed.site);
  if (!website) {
    return NextResponse.redirect(new URL(`/elitedata?gsc=error`, req.url));
  }

  let tokens;
  try {
    tokens = await exchangeCode(code);
  } catch {
    return NextResponse.redirect(
      new URL(`/elitedata/${parsed.site}/settings?gsc=error`, req.url),
    );
  }

  const existing = await getIntegration(website.id);
  const values = {
    googleEmail: tokens.email,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : existing?.refreshToken ?? null,
    tokenExpiry: tokens.expiry,
  };

  if (existing) {
    await db
      .update(integrationsGsc)
      .set(values)
      .where(eq(integrationsGsc.websiteId, website.id));
  } else {
    await db.insert(integrationsGsc).values({ websiteId: website.id, ...values });
  }

  const res = NextResponse.redirect(
    new URL(`/elitedata/${parsed.site}/settings?gsc=connected`, req.url),
  );
  res.cookies.delete("gsc_oauth_nonce");
  return res;
}

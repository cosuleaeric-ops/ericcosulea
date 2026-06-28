import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { integrationsGsc } from "@/lib/db/schema";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/webmasters/v3";
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
  "openid",
  "email",
];

export function gscConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
}

// ── Criptare token-uri (AES-256-GCM, cheie derivată din SESSION_SECRET) ──
function encKey(): Buffer {
  return createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest();
}
export function encrypt(text: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const d = createDecipheriv("aes-256-gcm", encKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

// ── OAuth ──
export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
};

function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return json.email ?? null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiry: Date;
  email: string | null;
}> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const t = (await res.json()) as TokenResponse;
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiry: new Date(Date.now() + (t.expires_in ?? 3600) * 1000),
    email: emailFromIdToken(t.id_token),
  };
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiry: Date }> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const t = (await res.json()) as TokenResponse;
  return { accessToken: t.access_token, expiry: new Date(Date.now() + (t.expires_in ?? 3600) * 1000) };
}

export async function getIntegration(websiteId: number) {
  const rows = await db
    .select()
    .from(integrationsGsc)
    .where(eq(integrationsGsc.websiteId, websiteId))
    .limit(1);
  return rows[0] ?? null;
}

// Access token valid (reîmprospătat dacă a expirat).
async function getValidAccessToken(websiteId: number): Promise<string | null> {
  const integ = await getIntegration(websiteId);
  if (!integ?.refreshToken) return null;
  const exp = integ.tokenExpiry?.getTime() ?? 0;
  if (integ.accessToken && exp > Date.now() + 60_000) {
    return decrypt(integ.accessToken);
  }
  const { accessToken, expiry } = await refreshAccessToken(decrypt(integ.refreshToken));
  await db
    .update(integrationsGsc)
    .set({ accessToken: encrypt(accessToken), tokenExpiry: expiry })
    .where(eq(integrationsGsc.websiteId, websiteId));
  return accessToken;
}

// ── Search Console API ──
export async function listProperties(websiteId: number): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const access = await getValidAccessToken(websiteId);
  if (!access) return [];
  const res = await fetch(`${API}/sites`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { siteEntry?: { siteUrl: string; permissionLevel: string }[] };
  return json.siteEntry ?? [];
}

export type KeywordRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

const cache = new Map<string, { exp: number; data: KeywordRow[] }>();

export type KeywordResult =
  | { connected: false }
  | { connected: true; needsProperty: true }
  | { connected: true; needsProperty: false; rows: KeywordRow[] };

export async function getKeywords(
  websiteId: number,
  startDate: string,
  endDate: string,
  path?: string,
): Promise<KeywordResult> {
  const integ = await getIntegration(websiteId);
  if (!integ?.refreshToken) return { connected: false };
  if (!integ.gscSiteUrl) return { connected: true, needsProperty: true };

  const cacheKey = `${websiteId}|${startDate}|${endDate}|${path ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.exp > Date.now()) {
    return { connected: true, needsProperty: false, rows: cached.data };
  }

  const access = await getValidAccessToken(websiteId);
  if (!access) return { connected: false };

  const body: Record<string, unknown> = {
    startDate,
    endDate,
    dimensions: ["query"],
    rowLimit: 1000,
  };
  if (path) {
    body.dimensionFilterGroups = [
      { filters: [{ dimension: "page", operator: "contains", expression: path }] },
    ];
  }

  const res = await fetch(
    `${API}/sites/${encodeURIComponent(integ.gscSiteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) return { connected: true, needsProperty: false, rows: [] };

  const json = (await res.json()) as {
    rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  };
  const rows: KeywordRow[] = (json.rows ?? []).map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
  cache.set(cacheKey, { exp: Date.now() + 3600_000, data: rows });
  return { connected: true, needsProperty: false, rows };
}

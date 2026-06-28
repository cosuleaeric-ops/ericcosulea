import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "@/lib/session";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: { domain?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain ?? "");
  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "Domeniu invalid" }, { status: 400 });
  }

  // publicId unic
  let publicId = "";
  for (let i = 0; i < 5; i++) {
    const candidate = `dfid_${randomBytes(5).toString("hex")}`;
    const exists = await db
      .select({ id: websites.id })
      .from(websites)
      .where(eq(websites.publicId, candidate))
      .limit(1);
    if (!exists.length) {
      publicId = candidate;
      break;
    }
  }
  if (!publicId) {
    return NextResponse.json({ error: "Could not allocate id" }, { status: 500 });
  }

  await db.insert(websites).values({
    publicId,
    domain,
    name: body.name?.trim() || domain,
    timezone: "Europe/Bucharest",
    faviconUrl: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  });

  return NextResponse.json({ ok: true, publicId });
}

import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "./db";
import { verificationTokens } from "./db/schema";

const TOKEN_TTL_MIN = 15;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMagicToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000);
  await db.insert(verificationTokens).values({ tokenHash, email, expiresAt });
  return token;
}

export async function consumeMagicToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const rows = await db.select().from(verificationTokens).where(eq(verificationTokens.tokenHash, tokenHash)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.usedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  await db.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, row.id));
  return row.email;
}

export async function sendMagicEmail(to: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing");
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: "Eric Cosulea <onboarding@resend.dev>",
    to,
    subject: "Login link — admin ericcosulea.ro",
    html: `<p>Click pentru a te autentifica:</p>
<p><a href="${link}">${link}</a></p>
<p>Link-ul expiră în ${TOKEN_TTL_MIN} minute. Dacă nu ai cerut tu autentificarea, ignoră acest email.</p>`,
  });
}

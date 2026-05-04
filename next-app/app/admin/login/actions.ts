"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createMagicToken, sendMagicEmail } from "@/lib/auth";

export async function loginAction(_prev: { ok?: boolean; error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!adminEmail) {
    return { error: "Server-ul nu are ADMIN_EMAIL configurat." };
  }
  if (email !== adminEmail) {
    return { ok: true };
  }

  const token = await createMagicToken(email);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/admin/login/verify?token=${token}`;

  try {
    await sendMagicEmail(email, link);
  } catch (err) {
    console.error("Email send failed", err);
    return { error: "Nu am putut trimite email-ul. Încearcă din nou." };
  }

  return { ok: true };
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}

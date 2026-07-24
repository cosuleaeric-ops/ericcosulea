import type { SessionOptions } from "iron-session";
import { ADMIN_HINT_COOKIE } from "./admin-bar-paths";

export type Session = {
  loggedInAt?: number;
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "",
  cookieName: "ericcosulea_admin",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  },
};

// Cookie-ul hint („un admin e logat în acest browser") e non-sensibil (doar "1").
// SameSite=None în producție ca browserul să-l trimită și CROSS-SITE: tracker-ul
// de pe outglow/cesaicumpar/etc. face sendBeacon către ericcosulea.ro/api/event,
// iar acolo vedem cookie-ul și aruncăm evenimentul — ne excludem pe noi de peste
// tot, automat, cât timp suntem logați. None cere Secure (prod e HTTPS). Dev
// rămâne Lax (tot localhost, cross-site irelevant). Cookie-ul de sesiune real
// (ericcosulea_admin) rămâne Lax+httpOnly — nu-l expunem cross-site.
const ADMIN_HINT_OPTS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

export function syncAdminHintCookie(
  response: { cookies: { set: (name: string, value: string, options: object) => void; delete: (name: string) => void } },
  loggedIn: boolean,
) {
  if (loggedIn) {
    response.cookies.set(ADMIN_HINT_COOKIE, "1", ADMIN_HINT_OPTS);
  } else {
    response.cookies.delete(ADMIN_HINT_COOKIE);
  }
}

export async function setAdminHintCookie() {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(ADMIN_HINT_COOKIE, "1", ADMIN_HINT_OPTS);
}

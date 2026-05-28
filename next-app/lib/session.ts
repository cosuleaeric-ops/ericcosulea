import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { ADMIN_HINT_COOKIE } from "./admin-bar-paths";

export type Session = {
  loggedInAt?: number;
};

export { ADMIN_HINT_COOKIE } from "./admin-bar-paths";

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

export async function getSession() {
  if (!sessionOptions.password) {
    throw new Error("SESSION_SECRET env var missing");
  }
  return getIronSession<Session>(await cookies(), sessionOptions);
}

export async function isAuthenticated() {
  const session = await getSession();
  return Boolean(session.loggedInAt);
}

export function syncAdminHintCookie(
  response: { cookies: { set: (name: string, value: string, options: object) => void; delete: (name: string) => void } },
  loggedIn: boolean,
) {
  if (loggedIn) {
    response.cookies.set(ADMIN_HINT_COOKIE, "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  } else {
    response.cookies.delete(ADMIN_HINT_COOKIE);
  }
}

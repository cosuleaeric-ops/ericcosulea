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

export async function setAdminHintCookie() {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  jar.set(ADMIN_HINT_COOKIE, "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

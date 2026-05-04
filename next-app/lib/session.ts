import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type Session = {
  loggedInAt?: number;
};

const sessionOptions: SessionOptions = {
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

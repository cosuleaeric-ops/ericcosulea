import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type Session } from "./session-config";

export type { Session } from "./session-config";
export { sessionOptions, syncAdminHintCookie, setAdminHintCookie } from "./session-config";
export { ADMIN_HINT_COOKIE } from "./admin-bar-paths";

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

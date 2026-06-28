export const ADMIN_BAR_HIDDEN_PREFIXES = ["/pnlpersonal", "/elite-deux", "/admin/login", "/elitedata"];
export const ADMIN_HINT_COOKIE = "ericcosulea_admin_hint";

export function isAdminBarHiddenPath(pathname: string): boolean {
  return ADMIN_BAR_HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

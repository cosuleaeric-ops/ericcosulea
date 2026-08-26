// Persistența perioadei selectate — cookie-uri citite atât pe server (pentru
// randarea inițială corectă, fără flash) cât și pe client (scriere la schimbare).
// Modul pur, fără "use client", ca să poată fi importat din server components.
import { PERIOD_ORDER, type PeriodKey } from "@/lib/analytics/range";

export const DASH_PERIOD_COOKIE = "dfa_dash_period";
export const OV_PERIOD_COOKIE = "dfa_ov_period";

// Istoric: dashboard-ul salva perioada per site. Le citim ca fallback o vreme,
// dar orice schimbare nouă se scrie global, ca overview-ul și toate site-urile
// să rămână pe aceeași perioadă.
export const legacyDashPeriodCookie = (publicId: string) =>
  `${DASH_PERIOD_COOKIE}_${publicId}`;

// Preset-urile comune pentru overview + dashboard. `custom` rămâne doar în
// dashboard, randat separat cu calendarul, deci nu intră aici.
export const SAVED_PERIODS = PERIOD_ORDER;
export const isSavedPeriod = (k: string): k is PeriodKey =>
  (SAVED_PERIODS as readonly string[]).includes(k);

// Tab-ul selectat în fiecare panou persistă tot prin cookie (server-readable),
// ca panoul să se randeze din prima pe tab-ul corect — fără fade la reload.
export const TAB_COOKIES = {
  sources: "dfa_tab_sources",
  pages: "dfa_tab_pages",
  geo: "dfa_tab_geo",
  tech: "dfa_tab_tech",
  bottom: "dfa_tab_bottom",
} as const;
export type TabGroup = keyof typeof TAB_COOKIES;
export type InitialTabs = Partial<Record<TabGroup, string>>;

// Scriere cookie pe client (apelat doar în browser; nefolosit pe server).
export function writeCookie(name: string, value: string) {
  try {
    document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

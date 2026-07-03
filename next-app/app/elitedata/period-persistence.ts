// Persistența perioadei selectate — cookie-uri citite atât pe server (pentru
// randarea inițială corectă, fără flash) cât și pe client (scriere la schimbare).
// Modul pur, fără "use client", ca să poată fi importat din server components.
import type { PeriodKey } from "@/lib/analytics/range";

export const DASH_PERIOD_COOKIE = "dfa_dash_period";
export const OV_PERIOD_COOKIE = "dfa_ov_period";

// Perioadele disponibile pe homepage (overview) — subset din PeriodKey.
export const OVERVIEW_PERIODS = ["today", "last24h", "last7", "last30"] as const;
export const isOverviewPeriod = (k: string): k is PeriodKey =>
  (OVERVIEW_PERIODS as readonly string[]).includes(k);

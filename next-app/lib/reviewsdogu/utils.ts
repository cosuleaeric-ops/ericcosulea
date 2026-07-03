export const RESTAURANT_KEYS = ["dogu", "turmerizza", "gustoria", "hotdog", "other"] as const;
export type RestaurantKey = (typeof RESTAURANT_KEYS)[number];

export const LABELS: Record<RestaurantKey, string> = {
  dogu: "DOGU",
  turmerizza: "Turmerizza",
  gustoria: "Domenii Bistro",
  hotdog: "HotDog de Bucuresti",
  other: "Altele",
};

export function fmtRon(v: number): string {
  return v.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " RON";
}

export function fmtRoDate(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

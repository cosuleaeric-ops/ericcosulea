import { and, between, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";

export const RESTAURANT_KEYS = ["dogu", "turmerizza", "gustoria", "hotdog", "other"] as const;
export type RestaurantKey = (typeof RESTAURANT_KEYS)[number];

export const LABELS: Record<RestaurantKey, string> = {
  dogu: "DOGU",
  turmerizza: "Turmerizza",
  gustoria: "Gustoria",
  hotdog: "HotDog de Bucuresti",
  other: "Altele",
};

type RestaurantStats = Record<RestaurantKey, number>;

const emptyStats = (): RestaurantStats => ({ dogu: 0, turmerizza: 0, gustoria: 0, hotdog: 0, other: 0 });

const keyOf = (k: string): RestaurantKey =>
  (RESTAURANT_KEYS as readonly string[]).includes(k) ? (k as RestaurantKey) : "other";

export type Comment = { provider: string; date: string; rating: number; comment: string };

export type BoltReport = {
  type: "bolt";
  platform: "Bolt";
  periodStart: string;
  periodEnd: string;
  counts: RestaurantStats;
  sales: RestaurantStats;
  positive: RestaurantStats;
  negative: RestaurantStats;
  comments: Record<RestaurantKey, Comment[]>;
  total: number;
  totalSales: number;
};

export type GlovoEntry = { date: string; time?: string; restaurant: string; amount?: number; reason?: string; responsible?: string };
export type GlovoReport = {
  type: "glovo";
  platform: "Glovo";
  periodStart: string;
  periodEnd: string;
  counts: RestaurantStats;
  sales: RestaurantStats;
  waitingTax: GlovoEntry[];
  waitingTotal: number;
  refunds: GlovoEntry[];
  refundTotal: number;
  cancels: GlovoEntry[];
  complaints: GlovoEntry[];
  total: number;
  totalSales: number;
};

export async function buildBoltReport(start: string, end: string): Promise<BoltReport> {
  const rows = await db.select().from(orders).where(
    and(eq(orders.platform, "bolt"), ne(orders.status, "cancelled"), between(orders.orderDate, start, end)),
  );

  const counts = emptyStats();
  const sales = emptyStats();
  const positive = emptyStats();
  const negative = emptyStats();
  const comments: Record<RestaurantKey, Comment[]> = { dogu: [], turmerizza: [], gustoria: [], hotdog: [], other: [] };

  for (const r of rows) {
    const k = keyOf(r.restaurantKey);
    counts[k] += 1;
    sales[k] += r.orderAmount;
    if (r.rating != null) {
      const n = r.rating;
      if (n >= 4) positive[k] += 1;
      else if (n >= 1) negative[k] += 1;
      if (r.ratingComment) {
        comments[k].push({ provider: r.restaurantName, date: r.orderDate, rating: n, comment: r.ratingComment });
      }
    }
  }

  return {
    type: "bolt", platform: "Bolt", periodStart: start, periodEnd: end,
    counts, sales, positive, negative, comments,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    totalSales: Object.values(sales).reduce((a, b) => a + b, 0),
  };
}

export async function buildGlovoReport(start: string, end: string): Promise<GlovoReport> {
  const allRows = await db.select().from(orders).where(
    and(eq(orders.platform, "glovo"), between(orders.orderDate, start, end)),
  );

  const counts = emptyStats();
  const sales = emptyStats();
  const waitingTax: GlovoEntry[] = [];
  const refunds: GlovoEntry[] = [];
  const cancels: GlovoEntry[] = [];
  const complaints: GlovoEntry[] = [];
  let waitingTotal = 0;
  let refundTotal = 0;

  for (const r of allRows) {
    if (r.status === "cancelled") {
      cancels.push({ date: r.orderDate, restaurant: r.restaurantName, reason: r.cancelReason || "—", responsible: r.cancelResponsible || "—" });
      continue;
    }
    const k = keyOf(r.restaurantKey);
    counts[k] += 1;
    sales[k] += r.orderAmount;
    if (r.waitingTax > 0) {
      waitingTax.push({ date: r.orderDate, time: r.orderTime, restaurant: r.restaurantName, amount: r.waitingTax });
      waitingTotal += r.waitingTax;
    }
    if (r.refundAmount > 0) {
      refunds.push({ date: r.orderDate, restaurant: r.restaurantName, amount: r.refundAmount });
      refundTotal += r.refundAmount;
    }
    if (r.hasComplaint) {
      complaints.push({ date: r.orderDate, restaurant: r.restaurantName, reason: r.complaintReason || "—" });
    }
  }

  return {
    type: "glovo", platform: "Glovo", periodStart: start, periodEnd: end,
    counts, sales, waitingTax, waitingTotal, refunds, refundTotal, cancels, complaints,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    totalSales: Object.values(sales).reduce((a, b) => a + b, 0),
  };
}

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

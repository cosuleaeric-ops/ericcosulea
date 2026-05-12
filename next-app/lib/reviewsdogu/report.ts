import { and, between, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import type { CsvRow } from "./parsers";
import { RESTAURANT_KEYS, LABELS, fmtRon, fmtRoDate, type RestaurantKey } from "./utils";

export { RESTAURANT_KEYS, LABELS, fmtRon, fmtRoDate };
export type { RestaurantKey } from "./utils";

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
  const rows = await getDb().select().from(orders).where(
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
  const allRows = await getDb().select().from(orders).where(
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

function resolveKey(name: string): RestaurantKey {
  const l = name.toLowerCase();
  if (l.includes("dogu")) return "dogu";
  if (l.includes("turmerizza")) return "turmerizza";
  if (l.includes("gustoria")) return "gustoria";
  if (l.includes("hotdog") || l.includes("hot dog")) return "hotdog";
  return "other";
}

export function buildBoltReportFromRows(rows: CsvRow[]): BoltReport {
  const counts = emptyStats();
  const sales = emptyStats();
  const positive = emptyStats();
  const negative = emptyStats();
  const comments: Record<RestaurantKey, Comment[]> = { dogu: [], turmerizza: [], gustoria: [], hotdog: [], other: [] };
  let minDate = "9999-99-99";
  let maxDate = "0000-00-00";

  for (const row of rows) {
    const status = (row["Finished Order Status"] ?? "").toLowerCase().trim();
    if (status === "cancelled" || status === "canceled") continue;

    const provider = row["Provider Name"] ?? "";
    const k = resolveKey(provider);
    const date = (row["Order Create Date"] ?? "").slice(0, 10);
    if (date < minDate) minDate = date;
    if (date > maxDate) maxDate = date;

    counts[k] += 1;
    sales[k] += parseFloat(row["Order Total Gross"] ?? "0") || 0;

    const ratingRaw = (row["Rating"] ?? "").trim();
    if (ratingRaw) {
      const n = parseInt(ratingRaw, 10);
      if (!isNaN(n)) {
        if (n >= 4) positive[k] += 1;
        else if (n >= 1) negative[k] += 1;
        const comment = (row["Rating Comment"] ?? "").trim();
        if (comment) comments[k].push({ provider, date, rating: n, comment });
      }
    }
  }

  return {
    type: "bolt", platform: "Bolt",
    periodStart: minDate === "9999-99-99" ? "" : minDate,
    periodEnd: maxDate === "0000-00-00" ? "" : maxDate,
    counts, sales, positive, negative, comments,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    totalSales: Object.values(sales).reduce((a, b) => a + b, 0),
  };
}


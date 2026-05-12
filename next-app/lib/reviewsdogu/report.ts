import type { CsvRow } from "./parsers";
import { RESTAURANT_KEYS, LABELS, fmtRon, fmtRoDate, type RestaurantKey } from "./utils";

export { RESTAURANT_KEYS, LABELS, fmtRon, fmtRoDate };
export type { RestaurantKey } from "./utils";

type RestaurantStats = Record<RestaurantKey, number>;

const emptyStats = (): RestaurantStats => ({ dogu: 0, turmerizza: 0, gustoria: 0, hotdog: 0, other: 0 });

function resolveKey(name: string): RestaurantKey {
  const l = name.toLowerCase();
  if (l.includes("dogu")) return "dogu";
  if (l.includes("turmerizza")) return "turmerizza";
  if (l.includes("gustoria")) return "gustoria";
  if (l.includes("hotdog") || l.includes("hot dog")) return "hotdog";
  return "other";
}

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

const glovoFloat = (v: string) => parseFloat(String(v).replace(",", ".").trim()) || 0;

export function buildGlovoReportFromRows(rows: CsvRow[]): GlovoReport {
  const counts = emptyStats();
  const sales = emptyStats();
  const waitingTax: GlovoEntry[] = [];
  const refunds: GlovoEntry[] = [];
  const cancels: GlovoEntry[] = [];
  const complaints: GlovoEntry[] = [];
  let waitingTotal = 0;
  let refundTotal = 0;
  let minDate = "9999-99-99";
  let maxDate = "0000-00-00";

  for (const row of rows) {
    const oid = (row["ID comandă"] ?? "").trim();
    if (!oid) continue;

    const providerRaw = (row["Denumire restaurant"] ?? "").replace(/\s*\(.*$/, "").trim();
    const datetime = (row["Comandă primită la"] ?? "").trim();
    const status = (row["Status comandă"] ?? "").trim();
    const isCancelled = status === "Anulată";
    const date = datetime.slice(0, 10);
    const time = datetime.length > 10 ? datetime.slice(11, 16) : undefined;

    if (date && date !== "0000-00-00") {
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    }

    if (isCancelled) {
      cancels.push({
        date, restaurant: providerRaw,
        reason: (row["Motiv anulare"] ?? "").trim() || "—",
        responsible: (row["Responsabil anulare"] ?? "").trim() || "—",
      });
      continue;
    }

    const k = resolveKey(providerRaw);
    counts[k] += 1;
    sales[k] += glovoFloat(row["Subtotal"] ?? "0");

    const wt = glovoFloat(row["Taxa pentru timpul de așteptare"] ?? "0");
    if (wt > 0) { waitingTax.push({ date, time, restaurant: providerRaw, amount: wt }); waitingTotal += wt; }

    const ref = glovoFloat(row["Rambursări partener"] ?? "0");
    if (ref > 0) { refunds.push({ date, restaurant: providerRaw, amount: ref }); refundTotal += ref; }

    if ((row["Are reclamație?"] ?? "").trim() === "Y") {
      complaints.push({ date, restaurant: providerRaw, reason: (row["Motiv reclamație"] ?? "").trim() || "—" });
    }
  }

  return {
    type: "glovo", platform: "Glovo",
    periodStart: minDate === "9999-99-99" ? "" : minDate,
    periodEnd: maxDate === "0000-00-00" ? "" : maxDate,
    counts, sales, waitingTax, waitingTotal, refunds, refundTotal, cancels, complaints,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    totalSales: Object.values(sales).reduce((a, b) => a + b, 0),
  };
}

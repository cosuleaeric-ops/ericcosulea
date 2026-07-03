import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import type { CsvRow } from "./parsers";

function resolveKey(name: string): string {
  const l = name.toLowerCase();
  if (l.includes("dogu")) return "dogu";
  if (l.includes("turmerizza")) return "turmerizza";
  if (l.includes("gustoria") || l.includes("domenii")) return "gustoria";
  if (l.includes("hotdog") || l.includes("hot dog")) return "hotdog";
  return "other";
}

const glovoFloat = (v: string) => parseFloat(String(v).replace(",", ".").trim()) || 0;

export type ImportResult = { saved: number; skipped: number };

export async function saveBoltRows(rows: CsvRow[]): Promise<ImportResult> {
  if (rows.length === 0) return { saved: 0, skipped: 0 };
  const values = rows
    .map((row) => {
      const oid = (row["Order Reference ID"] ?? "").trim();
      if (!oid) return null;
      const provider = row["Provider Name"] ?? "";
      const ratingRaw = (row["Rating"] ?? "").trim();
      return {
        platform: "bolt",
        orderId: oid,
        restaurantKey: resolveKey(provider),
        restaurantName: provider,
        orderDate: row["Order Create Date"] ?? "",
        orderTime: "",
        status: (row["Finished Order Status"] ?? "").toLowerCase().trim(),
        orderAmount: parseFloat(row["Order Total Gross"] ?? "0") || 0,
        rating: ratingRaw ? parseInt(ratingRaw, 10) : null,
        ratingComment: (row["Rating Comment"] ?? "").trim(),
        waitingTax: 0,
        refundAmount: 0,
        cancelReason: "",
        cancelResponsible: "",
        hasComplaint: false,
        complaintReason: "",
        importedAt: new Date(),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (values.length === 0) return { saved: 0, skipped: 0 };
  const result = await getDb().insert(orders).values(values).onConflictDoNothing({ target: [orders.platform, orders.orderId] }).returning({ id: orders.id });
  return { saved: result.length, skipped: values.length - result.length };
}

export async function saveGlovoRows(rows: CsvRow[]): Promise<ImportResult> {
  if (rows.length === 0) return { saved: 0, skipped: 0 };
  const values = rows
    .map((row) => {
      const oid = (row["ID comandă"] ?? "").trim();
      if (!oid) return null;
      const providerRaw = (row["Denumire restaurant"] ?? "").replace(/\s*\(.*$/, "").trim();
      const datetime = (row["Comandă primită la"] ?? "").trim();
      const status = (row["Status comandă"] ?? "").trim();
      const isCancelled = status === "Anulată";
      return {
        platform: "glovo",
        orderId: oid,
        restaurantKey: resolveKey(providerRaw),
        restaurantName: providerRaw,
        orderDate: datetime.slice(0, 10),
        orderTime: datetime.length > 10 ? datetime.slice(11, 16) : "",
        status: isCancelled ? "cancelled" : "delivered",
        orderAmount: isCancelled ? 0 : glovoFloat(row["Subtotal"] ?? "0"),
        rating: null,
        ratingComment: "",
        waitingTax: glovoFloat(row["Taxa pentru timpul de așteptare"] ?? "0"),
        refundAmount: glovoFloat(row["Rambursări partener"] ?? "0"),
        cancelReason: isCancelled ? (row["Motiv anulare"] ?? "").trim() : "",
        cancelResponsible: isCancelled ? (row["Responsabil anulare"] ?? "").trim() : "",
        hasComplaint: (row["Are reclamație?"] ?? "").trim() === "Y",
        complaintReason: (row["Motiv reclamație"] ?? "").trim(),
        importedAt: new Date(),
      };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  if (values.length === 0) return { saved: 0, skipped: 0 };
  const result = await getDb().insert(orders).values(values).onConflictDoNothing({ target: [orders.platform, orders.orderId] }).returning({ id: orders.id });
  return { saved: result.length, skipped: values.length - result.length };
}

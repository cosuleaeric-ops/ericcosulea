import { cookies } from "next/headers";
import { computeRange, type PeriodKey } from "@/lib/analytics/range";
import { getOverview } from "@/lib/analytics/queries";
import { OverviewClient } from "./OverviewClient";
import { OV_PERIOD_COOKIE, isOverviewPeriod } from "./period-persistence";

export const dynamic = "force-dynamic";

function ownerName(): string {
  const local = (process.env.ADMIN_EMAIL ?? "").split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function AnalyticsOverviewPage() {
  // Perioada salvată e într-un cookie (server-readable) → randăm din prima
  // vederea corectă, fără flash last7 → 24h de după hidratare.
  const saved = (await cookies()).get(OV_PERIOD_COOKIE)?.value;
  const period: PeriodKey = saved && isOverviewPeriod(saved) ? saved : "last7";
  const granularity = period === "last24h" || period === "today" ? "hourly" : "daily";
  const initial = await getOverview(computeRange(period), granularity);
  return <OverviewClient ownerName={ownerName()} initial={initial} initialPeriod={period} />;
}

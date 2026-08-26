import { cookies } from "next/headers";
import { computeRange, defaultGranularity, type PeriodKey } from "@/lib/analytics/range";
import { getOverview } from "@/lib/analytics/queries";
import { OverviewClient } from "./OverviewClient";
import {
  DASH_PERIOD_COOKIE,
  OV_PERIOD_COOKIE,
  isSavedPeriod,
} from "./period-persistence";

export const dynamic = "force-dynamic";

const NUME = "Eric";

export default async function AnalyticsOverviewPage() {
  // Perioada salvată e într-un cookie (server-readable) → randăm din prima
  // vederea corectă, fără flash last7 → 24h de după hidratare.
  const jar = await cookies();
  const saved = jar.get(DASH_PERIOD_COOKIE)?.value ?? jar.get(OV_PERIOD_COOKIE)?.value;
  const period: PeriodKey = saved && isSavedPeriod(saved) ? saved : "last7";
  const granularity = defaultGranularity(period);
  const initial = await getOverview(computeRange(period), granularity);
  return <OverviewClient ownerName={NUME} initial={initial} initialPeriod={period} />;
}

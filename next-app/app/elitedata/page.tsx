import { computeRange } from "@/lib/analytics/range";
import { getOverview } from "@/lib/analytics/queries";
import { OverviewClient } from "./OverviewClient";

export const dynamic = "force-dynamic";

function ownerName(): string {
  const local = (process.env.ADMIN_EMAIL ?? "").split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function AnalyticsOverviewPage() {
  const initial = await getOverview(computeRange("last7"), "daily");
  return <OverviewClient ownerName={ownerName()} initial={initial} />;
}

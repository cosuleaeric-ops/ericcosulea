import { notFound } from "next/navigation";
import { getStats, getWebsiteByPublicId, listWebsites } from "@/lib/analytics/queries";
import { computeRange, defaultGranularity } from "@/lib/analytics/range";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function SiteDashboardPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const website = await getWebsiteByPublicId(publicId);
  if (!website) notFound();

  const all = await listWebsites();
  const sites = all.map((s) => ({
    publicId: s.publicId,
    domain: s.domain,
    faviconUrl: s.faviconUrl,
  }));

  // Randăm pe server datele pentru vederea implicită (last7/daily) ca să
  // eliminăm fetch-ul client de după hidratare — fără el, dashboard-ul stă
  // pe skeleton până se face un round-trip suplimentar la /api/analytics/stats.
  const initialData = await getStats({
    websiteId: website.id,
    kpiGoalName: website.kpiGoalName,
    tz: website.timezone,
    range: computeRange("last7", 0),
    granularity: defaultGranularity("last7"),
    compare: false,
    filters: {},
  });

  return (
    <Dashboard
      website={{
        publicId: website.publicId,
        domain: website.domain,
        name: website.name,
        timezone: website.timezone,
        faviconUrl: website.faviconUrl,
        kpiGoalName: website.kpiGoalName,
      }}
      sites={sites}
      initialData={initialData}
    />
  );
}

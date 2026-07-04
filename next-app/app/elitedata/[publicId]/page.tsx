import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getStats, getWebsiteByPublicId, listWebsites } from "@/lib/analytics/queries";
import { computeRange, defaultGranularity, PERIOD_ORDER, type PeriodKey } from "@/lib/analytics/range";
import Dashboard from "./Dashboard";
import {
  DASH_PERIOD_COOKIE,
  TAB_COOKIES,
  type InitialTabs,
  type TabGroup,
} from "../period-persistence";

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

  const jar = await cookies();

  // Perioada salvată e într-un cookie (server-readable) ca să randăm din prima
  // vederea corectă — fără flash last7 → 24h de după hidratare.
  const saved = jar.get(DASH_PERIOD_COOKIE)?.value as PeriodKey | undefined;
  const period: PeriodKey =
    saved && PERIOD_ORDER.includes(saved) ? saved : "last7";

  // Tab-ul selectat în fiecare panou (Channel/Referrer…, Hostname/Page…, etc.).
  const initialTabs: InitialTabs = {};
  for (const g of Object.keys(TAB_COOKIES) as TabGroup[]) {
    const v = jar.get(TAB_COOKIES[g])?.value;
    if (v) initialTabs[g] = v;
  }

  // Randăm pe server datele pentru perioada salvată ca să eliminăm fetch-ul
  // client de după hidratare — fără el, dashboard-ul stă pe skeleton.
  const initialData = await getStats({
    websiteId: website.id,
    publicId,
    kpiGoalName: website.kpiGoalName,
    tz: website.timezone,
    range: computeRange(period, 0),
    granularity: defaultGranularity(period),
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
      initialPeriod={period}
      initialTabs={initialTabs}
    />
  );
}

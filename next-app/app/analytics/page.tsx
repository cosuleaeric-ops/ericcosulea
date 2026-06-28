import Link from "next/link";
import { Share2, ShoppingBag } from "lucide-react";
import { getOverview } from "@/lib/analytics/queries";
import { formatNumber } from "@/lib/analytics/format";
import { Sparkline } from "./_components/Sparkline";
import { AddWebsite } from "./AddWebsite";

export const dynamic = "force-dynamic";

function ownerName(): string {
  const local = (process.env.ADMIN_EMAIL ?? "").split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function AnalyticsOverviewPage() {
  const { totalVisitors, sites } = await getOverview();

  return (
    <>
      <div className="dfa-overview-head">
        <h1 className="dfa-headline">
          Hey {ownerName()}, you got{" "}
          <strong>{formatNumber(totalVisitors)} visitors</strong> in the{" "}
          <span className="dfa-pill-period">last 7 days</span>
        </h1>
        <div className="dfa-overview-actions">
          <button className="dfa-btn">
            <Share2 size={15} /> Share
          </button>
          <button className="dfa-btn">
            <ShoppingBag size={15} /> Order
          </button>
          <AddWebsite />
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="dfa-empty">
          <h3>No websites yet</h3>
          <p>Adaugă primul site ca să primești pageview-uri.</p>
        </div>
      ) : (
        <div className="dfa-site-grid">
          {sites.map((s) => (
            <Link
              key={s.publicId}
              href={`/analytics/${s.publicId}`}
              className="dfa-card dfa-site-card"
            >
              <div className="dfa-site-card-head">
                {s.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.faviconUrl} alt="" width={18} height={18} className="dfa-favicon-img" />
                ) : (
                  <span className="dfa-favicon">{s.domain.charAt(0).toUpperCase()}</span>
                )}
                {s.domain}
              </div>
              <Sparkline data={s.spark} />
              <div className="dfa-site-card-foot">
                <strong>{formatNumber(s.visitors)}</strong> visitors
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

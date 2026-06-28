import Link from "next/link";
import { Share2, ShoppingBag, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function ownerName(): string {
  const local = (process.env.ADMIN_EMAIL ?? "").split("@")[0] ?? "";
  if (!local) return "there";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default async function AnalyticsOverviewPage() {
  const sites = await db.select().from(websites).orderBy(websites.createdAt);

  return (
    <>
      <div className="dfa-overview-head">
        <h1 className="dfa-headline">
          Hey {ownerName()}, you got <strong>0 visitors</strong> in the{" "}
          <span className="dfa-pill-period">last 7 days</span>
        </h1>
        <div className="dfa-overview-actions">
          <button className="dfa-btn">
            <Share2 size={15} /> Share
          </button>
          <button className="dfa-btn">
            <ShoppingBag size={15} /> Order
          </button>
          <button className="dfa-btn dfa-btn-primary">
            <Plus size={15} /> Website
          </button>
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="dfa-empty">
          <h3>No websites yet</h3>
          <p>
            Adaugă primul site ca să primești pageview-uri. Datele demo apar
            după pasul de seed (M2).
          </p>
        </div>
      ) : (
        <div className="dfa-site-grid">
          {sites.map((s) => (
            <Link
              key={s.id}
              href={`/analytics/${s.publicId}`}
              className="dfa-card dfa-site-card"
            >
              <div className="dfa-site-card-head">
                <span className="dfa-favicon">{s.domain.charAt(0).toUpperCase()}</span>
                {s.domain}
              </div>
              <div className="dfa-site-card-spark" />
              <div className="dfa-site-card-foot">— visitors</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

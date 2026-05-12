import Link from "next/link";
import type { Metadata } from "next";
import BoltReportForm from "./BoltReportForm";
import GlovoReportForm from "./GlovoReportForm";

export const metadata: Metadata = {
  title: "Reviews & Comenzi - DOGU",
  robots: { index: false, follow: false },
};

type SP = Promise<{ platform?: string }>;

export default async function ReviewsdoguPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const platform = sp.platform === "glovo" ? "glovo" : "bolt";

  return (
    <main className="page page-narrow">
      <section className="page-section">
        <Link className="post-back" href="/dogu">← dogu</Link>
        <h1 className="page-title">reviews & comenzi</h1>

        <div className="reviews-tabs">
          <a href="?platform=bolt" className={`btn${platform === "bolt" ? " reviews-tab-active" : ""}`}>Bolt</a>
          <a href="?platform=glovo" className={`btn${platform === "glovo" ? " reviews-tab-active" : ""}`}>Glovo</a>
        </div>

        {platform === "bolt" && <BoltReportForm />}
        {platform === "glovo" && <GlovoReportForm />}
      </section>
    </main>
  );
}

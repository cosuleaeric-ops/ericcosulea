import Link from "next/link";
import type { Metadata } from "next";
import RaportApp from "./RaportApp";

export const metadata: Metadata = {
  title: "Raport P&L lunar - DOGU",
  robots: { index: false, follow: false },
};

export default function RaportPage() {
  return (
    <main className="page page-narrow">
      <section className="page-section">
        <Link className="post-back" href="/dogu">← dogu</Link>
        <h1 className="page-title">raport p&l lunar</h1>
        <p className="page-lead">Încarcă PDF-urile Wolt, Glovo și Bolt — extragem automat sumele facturilor.</p>
        <RaportApp />
      </section>
    </main>
  );
}

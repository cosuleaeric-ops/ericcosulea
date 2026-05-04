import Link from "next/link";
import type { Metadata } from "next";
import VanzariApp from "./VanzariApp";

export const metadata: Metadata = {
  title: "Vânzări DOGU - Restaurant",
  robots: { index: false, follow: false },
};

export default function VanzariPage() {
  return (
    <main className="page page-narrow">
      <section className="page-section">
        <Link className="post-back" href="/dogu">← dogu</Link>
        <h1 className="page-title">vânzări — restaurant</h1>
        <VanzariApp />
      </section>
    </main>
  );
}

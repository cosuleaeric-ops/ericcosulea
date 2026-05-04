import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DOGU - Dashboard intern",
  robots: { index: false, follow: false },
};

const TILES = [
  { href: "/reviewsdogu", icon: "⭐", label: "Reviews & Comenzi", desc: "Rapoarte Bolt & Glovo — comenzi, reviews, taxe, rambursări", bg: "#FFF3E0" },
  { href: "/vanzaridogu", icon: "📊", label: "Vânzări Restaurant", desc: "Rapoarte Breeze — vânzări per restaurant din secțiunea Restaurant", bg: "#E8F5E9" },
  { href: "/raportpnldogu", icon: "📑", label: "Raport P&L lunar", desc: "Încarcă PDF-urile Wolt, Glovo și Bolt — extragem automat sumele facturilor", bg: "#E3F2FD" },
];

export default function DoguHub() {
  return (
    <main className="page page-narrow">
      <section className="page-section">
        <Link className="post-back" href="/admin">← admin</Link>
        <h1 className="page-title">🍔 DOGU</h1>
        <p className="page-lead">Dashboard intern</p>
        <div className="dogu-nav">
          {TILES.map((t) => (
            <Link key={t.href} href={t.href} className="dogu-tile" style={{ ["--tile-bg" as string]: t.bg }}>
              <div className="dogu-tile-icon">{t.icon}</div>
              <div className="dogu-tile-body">
                <div className="dogu-tile-label">{t.label}</div>
                <div className="dogu-tile-desc">{t.desc}</div>
              </div>
              <span className="dogu-tile-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

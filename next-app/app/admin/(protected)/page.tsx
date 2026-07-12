import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostsForAdmin } from "@/lib/db/queries";
import "../admin.css";

export const metadata: Metadata = {
  title: "admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const posts = await getAllPostsForAdmin();
  const postCount = posts.length;
  const latestPost = posts[0] ?? null;

  return (
    <>
      <div className="admin-wrap">
        <div className="admin-top">
          <h1>Admin</h1>
        </div>
        <p className="admin-intro">hub-ul tau intern pentru scris, organizare si sprinturi scurte de lucru.</p>

        <h2 className="admin-section-title">tooluri personale</h2>
        <section className="admin-quick-grid" aria-label="Tooluri personale">
          <Link className="admin-quick-card" href="/pnlpersonal">
            <h2>💰 p&amp;l personal</h2>
            <p>cheltuieli, venituri și portofel — cash, ING, Revolut, Trading212.</p>
          </Link>
          <Link className="admin-quick-card" href="/dogu">
            <h2>🍜 dogu</h2>
            <p>reviews, comenzi și vânzări restaurant — Bolt, Glovo, Breeze.</p>
          </Link>
          <Link className="admin-quick-card" href="/brain">
            <h2>🧠 brain</h2>
            <p>second brain — pagini durabile și gânduri cronologice, citit de AI la decizii.</p>
          </Link>
          <Link className="admin-quick-card" href="/elite-deux">
            <h2>⚡ elite deux</h2>
            <p>task grid săptămânal cu teme, coloane configurabile și export.</p>
          </Link>
        </section>

        <h2 className="admin-section-title">website</h2>
        <section className="admin-quick-grid" aria-label="Website">
          <Link className="admin-quick-card" href="/admin/projects">
            <h2>🚀 proiecte</h2>
            <p>adaugă, editează și șterge proiectele afișate pe pagina principală.</p>
          </Link>
          <Link className="admin-quick-card" href="/inspo">
            <h2>🖼 inspo</h2>
            <p>upload + delete pe pagina /inspo.</p>
          </Link>
        </section>

        <h2 className="admin-section-title">overview blog</h2>
        <section className="admin-quick-grid" aria-label="Blog">
          <Link className="admin-quick-card" href="/admin/posts">
            <h2>{postCount} articole</h2>
            <p>{latestPost ? `ultimul: ${latestPost.title}` : "inca nu ai publicat nimic."}</p>
          </Link>
          <Link className="admin-quick-card" href="/admin/posts/new">
            <h2>articol nou</h2>
            <p>deschide editorul și pornește direct un draft nou.</p>
          </Link>
        </section>
      </div>
    </>
  );
}

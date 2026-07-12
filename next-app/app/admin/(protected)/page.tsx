import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostsForAdmin } from "@/lib/db/queries";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full gap-0 py-5 transition-all group-hover:-translate-y-0.5 group-hover:border-ring group-hover:shadow-lg">
        <CardHeader className="gap-2 px-5">
          <CardTitle className="text-3xl leading-none font-semibold lowercase">{title}</CardTitle>
          <CardDescription className="text-base">{desc}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function AdminDashboard() {
  const posts = await getAllPostsForAdmin();
  const postCount = posts.length;
  const latestPost = posts[0] ?? null;

  return (
    <div className="mx-auto max-w-[820px] px-6 py-6">
      <h1 className="text-4xl font-semibold">Admin</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        hub-ul tau intern pentru scris, organizare si sprinturi scurte de lucru.
      </p>

      <h2 className="mt-9 text-2xl font-semibold lowercase">tooluri personale</h2>
      <section className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2" aria-label="Tooluri personale">
        <QuickCard
          href="/pnlpersonal"
          title="💰 p&l personal"
          desc="cheltuieli, venituri și portofel — cash, ING, Revolut, Trading212."
        />
        <QuickCard
          href="/dogu"
          title="🍜 dogu"
          desc="reviews, comenzi și vânzări restaurant — Bolt, Glovo, Breeze."
        />
        <QuickCard
          href="/brain"
          title="🧠 brain"
          desc="second brain — pagini durabile și gânduri cronologice, citit de AI la decizii."
        />
        <QuickCard
          href="/elite-deux"
          title="⚡ elite deux"
          desc="task grid săptămânal cu teme, coloane configurabile și export."
        />
      </section>

      <h2 className="mt-9 text-2xl font-semibold lowercase">website</h2>
      <section className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2" aria-label="Website">
        <QuickCard
          href="/admin/projects"
          title="🚀 proiecte"
          desc="adaugă, editează și șterge proiectele afișate pe pagina principală."
        />
        <QuickCard href="/inspo" title="🖼 inspo" desc="upload + delete pe pagina /inspo." />
      </section>

      <h2 className="mt-9 text-2xl font-semibold lowercase">overview blog</h2>
      <section className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2" aria-label="Blog">
        <QuickCard
          href="/admin/posts"
          title={`${postCount} articole`}
          desc={latestPost ? `ultimul: ${latestPost.title}` : "inca nu ai publicat nimic."}
        />
        <QuickCard
          href="/admin/posts/new"
          title="articol nou"
          desc="deschide editorul și pornește direct un draft nou."
        />
      </section>
    </div>
  );
}

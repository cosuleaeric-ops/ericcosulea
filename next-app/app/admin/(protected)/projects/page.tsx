import Link from "next/link";
import type { Metadata } from "next";
import { getProjectsForHome } from "@/lib/db/queries";
import ProjectsList from "./ProjectsList";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "projects - admin",
  robots: { index: false, follow: false },
};

export default async function AdminProjectsList() {
  const projects = await getProjectsForHome();

  return (
    <main className="mx-auto max-w-[700px] px-9 py-8">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← admin
      </Link>
      <div className="mt-3 mb-1 flex items-center justify-between">
        <h2 className="text-3xl font-semibold lowercase">projects</h2>
        <Button asChild>
          <Link href="/admin/projects/new">+ proiect nou</Link>
        </Button>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">trage rândurile ca să schimbi ordinea de pe homepage.</p>
      <ProjectsList
        initial={projects.map((p) => ({ id: p.id, name: p.name, url: p.url, logo: p.logo }))}
      />
    </main>
  );
}

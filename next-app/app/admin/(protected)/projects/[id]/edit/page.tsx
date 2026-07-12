import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProjectForm from "../../ProjectForm";
import { saveProjectAction } from "../../actions";
import { getProjectById } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "editează proiect - admin",
  robots: { index: false, follow: false },
};

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProjectById(Number(id));
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-[700px] px-9 py-8">
      <section>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/admin/projects">← projects</Link>
        <h2 className="mt-3 text-3xl font-semibold lowercase">editează proiect</h2>
        <ProjectForm initial={project} saveAction={saveProjectAction} />
      </section>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import ProjectForm from "../ProjectForm";
import { saveProjectAction } from "../actions";

export const metadata: Metadata = {
  title: "proiect nou - admin",
  robots: { index: false, follow: false },
};

export default function NewProjectPage() {
  return (
    <main className="mx-auto max-w-[700px] px-9 py-8">
      <section>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/admin/projects">← projects</Link>
        <h2 className="mt-3 text-3xl font-semibold lowercase">proiect nou</h2>
        <ProjectForm saveAction={saveProjectAction} />
      </section>
    </main>
  );
}

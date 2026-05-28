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
    <main className="page">
      <section className="section">
        <Link className="post-back" href="/admin/projects">← projects</Link>
        <h2>proiect nou</h2>
        <ProjectForm saveAction={saveProjectAction} />
      </section>
    </main>
  );
}

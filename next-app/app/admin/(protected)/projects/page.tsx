import Link from "next/link";
import type { Metadata } from "next";
import { getProjectsForHome } from "@/lib/db/queries";
import { deleteProjectAction } from "./actions";
import DeleteButton from "../posts/DeleteButton";

export const metadata: Metadata = {
  title: "projects - admin",
  robots: { index: false, follow: false },
};

export default async function AdminProjectsList() {
  const projects = await getProjectsForHome();

  return (
    <main className="page">
      <section className="section">
        <Link className="post-back" href="/admin">← admin</Link>
        <div className="admin-list-header">
          <h2>projects</h2>
          <Link href="/admin/projects/new" className="btn">+ proiect nou</Link>
        </div>
        <div className="post-list">
          {projects.map((p) => (
            <div key={p.id} className="post-item admin-row">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                <img src={p.logo} alt="" style={{ width: 22, height: 22, objectFit: "contain", borderRadius: 6 }} />
                <Link href={`/admin/projects/${p.id}/edit`} className="post-item-title">{p.name}</Link>
                <span className="post-item-date">sort: {p.sort}</span>
              </span>
              <div className="admin-row-meta">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="post-item-date">vezi →</a>
                <DeleteButton action={deleteProjectAction} id={p.id} confirmText={`Ștergi "${p.name}"?`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostsForAdmin } from "@/lib/db/queries";
import { deletePostAction } from "./actions";
import DeleteButton from "./DeleteButton";

export const metadata: Metadata = {
  title: "posts - admin",
  robots: { index: false, follow: false },
};

const RO_MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function formatRoDate(date: Date): string {
  return `${date.getDate()} ${RO_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default async function AdminPostsList() {
  const posts = await getAllPostsForAdmin();

  return (
    <main className="page">
      <section className="section">
        <Link className="post-back" href="/admin">← admin</Link>
        <div className="admin-list-header">
          <h2>posts</h2>
          <Link href="/admin/posts/new" className="btn">+ articol nou</Link>
        </div>
        <div className="post-list">
          {posts.map((p) => (
            <div key={p.id} className="post-item admin-row">
              <Link href={`/admin/posts/${p.id}/edit`} className="post-item-title">{p.title}</Link>
              <div className="admin-row-meta">
                <span className="post-item-date">{formatRoDate(p.publishedAt)}</span>
                <Link href={`/${p.slug}`} target="_blank" className="post-item-date">vezi →</Link>
                <DeleteButton action={deletePostAction} id={p.id} confirmText={`Ștergi "${p.title}"?`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

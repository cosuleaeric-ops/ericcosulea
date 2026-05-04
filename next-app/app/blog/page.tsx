import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "articole - Eric Cosulea",
};

const RO_MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

function formatRoDate(date: Date): string {
  return `${date.getDate()} ${RO_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default async function BlogIndex() {
  const posts = await getAllPosts();

  return (
    <main className="page">
      <section className="section">
        <h2>articole</h2>
        {posts.length === 0 ? (
          <p>Nu exista articole inca.</p>
        ) : (
          <div className="post-list">
            {posts.map((p) => (
              <Link key={p.slug} className="post-item" href={`/${p.slug}`}>
                <span className="post-item-title">{p.title}</span>
                <span className="post-item-date">{formatRoDate(p.publishedAt)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

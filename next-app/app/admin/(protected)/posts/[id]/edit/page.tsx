import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PostEditor from "../../PostEditor";
import { savePostAction } from "../../actions";
import { getPostById } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "editează articol - admin",
  robots: { index: false, follow: false },
};

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostById(Number(id));
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-[700px] px-9 py-8">
      <section>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/admin/posts">← posts</Link>
        <h2 className="mt-3 text-3xl font-semibold lowercase">editează articol</h2>
        <PostEditor
          initial={{
            id: post.id,
            slug: post.slug,
            title: post.title,
            contentHtml: post.contentHtml,
            excerpt: post.excerpt ?? "",
            publishedAt: toLocalInput(post.publishedAt),
          }}
          saveAction={savePostAction}
        />
      </section>
    </main>
  );
}

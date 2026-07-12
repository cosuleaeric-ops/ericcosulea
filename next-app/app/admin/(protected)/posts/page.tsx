import Link from "next/link";
import type { Metadata } from "next";
import { getAllPostsForAdmin } from "@/lib/db/queries";
import { deletePostAction } from "./actions";
import DeleteButton from "./DeleteButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <main className="mx-auto max-w-[700px] px-9 py-8">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← admin
      </Link>
      <div className="mt-3 mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-semibold lowercase">posts</h2>
        <Button asChild>
          <Link href="/admin/posts/new">+ articol nou</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {posts.map((p) => (
          <Card key={p.id} className="flex-row items-center justify-between gap-4 px-4 py-3">
            <Link href={`/admin/posts/${p.id}/edit`} className="min-w-0 truncate font-medium hover:underline">
              {p.title}
            </Link>
            <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
              <span>{formatRoDate(p.publishedAt)}</span>
              <Link href={`/${p.slug}`} target="_blank" className="hover:text-foreground">
                vezi →
              </Link>
              <DeleteButton action={deletePostAction} id={p.id} confirmText={`Ștergi "${p.title}"?`} />
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}

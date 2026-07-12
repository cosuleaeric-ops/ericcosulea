import Link from "next/link";
import type { Metadata } from "next";
import PostEditor from "../PostEditor";
import { savePostAction } from "../actions";

export const metadata: Metadata = {
  title: "articol nou - admin",
  robots: { index: false, follow: false },
};

export default function NewPostPage() {
  return (
    <main className="mx-auto max-w-[820px] px-6 py-8">
      <section>
        <Link className="text-sm text-muted-foreground hover:text-foreground" href="/admin/posts">← posts</Link>
        <h2 className="mt-3 text-3xl font-semibold lowercase">articol nou</h2>
        <PostEditor saveAction={savePostAction} />
      </section>
    </main>
  );
}

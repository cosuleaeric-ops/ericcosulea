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
    <main className="page">
      <section className="section">
        <Link className="post-back" href="/admin/posts">← posts</Link>
        <h2>articol nou</h2>
        <PostEditor saveAction={savePostAction} />
      </section>
    </main>
  );
}

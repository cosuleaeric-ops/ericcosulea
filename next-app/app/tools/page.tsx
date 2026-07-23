import Link from "next/link";
import type { Metadata } from "next";
import { getPageBySlug } from "@/lib/db/queries";
import { rewriteUploadUrls } from "@/lib/blob";

export const revalidate = 86400; // o dată pe zi — publicarea dă revalidatePath, restul e static (Neon compute)

export const metadata: Metadata = {
  title: "tools - Eric Cosulea",
};

const FALLBACK_LEAD = "O colecție de programe/aplicații pe care le folosesc în proiectele mele.";

export default async function ToolsPage() {
  const page = await getPageBySlug("tools");

  return (
    <main className="page page-narrow">
      <section className="page-section">
        <Link className="post-back" href="/">← homepage</Link>
        <h1 className="page-title">tools</h1>
        {page?.contentHtml ? (
          <div className="post-content" dangerouslySetInnerHTML={{ __html: rewriteUploadUrls(page.contentHtml) }} />
        ) : (
          <p className="page-lead">{FALLBACK_LEAD}</p>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { getAllCopyImages } from "@/lib/db/queries";
import { blobUrl } from "@/lib/blob";
import CopyGallery from "./CopyGallery";

export const metadata: Metadata = {
  title: "copywriting",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CopywritingPage() {
  const images = await getAllCopyImages();

  return (
    <main className="page page-wide">
      <section className="page-section">
        <Link className="post-back" href="/admin">← admin</Link>
        <h1 className="page-title">copywriting</h1>
        <p className="page-lead">exemple mișto de copywriting, salvate pentru inspirație</p>
        <CopyGallery
          images={images.map((i) => ({ id: i.id, src: blobUrl(`copywriting/${i.filename}`) }))}
        />
      </section>
    </main>
  );
}

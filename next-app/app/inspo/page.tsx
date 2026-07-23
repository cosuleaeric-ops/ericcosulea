import Link from "next/link";
import type { Metadata } from "next";
import { getAllImages } from "@/lib/db/queries";
import { blobUrl } from "@/lib/blob";
import InspoGallery from "./InspoGallery";

export const revalidate = 86400; // o dată pe zi — publicarea dă revalidatePath, restul e static (Neon compute)

export const metadata: Metadata = {
  title: "inspo - Eric Cosulea",
};

export default async function InspoPage() {
  const images = await getAllImages();

  return (
    <main className="page page-wide">
      <section className="page-section">
        <Link className="post-back" href="/">← homepage</Link>
        <h1 className="page-title">inspo</h1>
        <p className="page-lead">imagini salvate pentru zilele alea naspa</p>
        <InspoGallery
          images={images.map((i) => ({ id: i.id, src: blobUrl(`inspo/${i.filename}`) }))}
        />
      </section>
    </main>
  );
}

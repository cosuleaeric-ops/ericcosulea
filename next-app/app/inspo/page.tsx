import Link from "next/link";
import type { Metadata } from "next";
import { getAllImages } from "@/lib/db/queries";
import { BLOB_BASE_URL } from "@/lib/blob";
import InspoGallery from "./InspoGallery";

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
        <InspoGallery images={images.map((i) => ({ id: i.id, filename: i.filename }))} baseUrl={BLOB_BASE_URL} />
      </section>
    </main>
  );
}

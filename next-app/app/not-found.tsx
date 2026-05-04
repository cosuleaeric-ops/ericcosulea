import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <section className="section" style={{ textAlign: "center", paddingTop: "4rem" }}>
        <h1 style={{ fontSize: "5rem", margin: 0, lineHeight: 1 }}>404</h1>
        <p style={{ marginTop: "1rem" }}>pagina nu există</p>
        <Link className="post-back" href="/" style={{ display: "inline-block", marginTop: "1.5rem" }}>
          ← înapoi acasă
        </Link>
      </section>
    </main>
  );
}

"use client";

export default function ReviewsdoguError({ error }: { error: Error & { digest?: string } }) {
  return (
    <main className="page page-narrow">
      <section className="page-section">
        <h1 className="page-title" style={{ color: "#b91c1c" }}>Eroare</h1>
        <pre style={{ background: "#fef2f2", padding: "16px", borderRadius: "8px", fontSize: "13px", overflow: "auto", whiteSpace: "pre-wrap" }}>
          {error.message || "Eroare necunoscută"}
          {error.digest ? `\n\nDigest: ${error.digest}` : ""}
        </pre>
      </section>
    </main>
  );
}

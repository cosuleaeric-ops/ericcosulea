import Link from "next/link";
import type { Metadata } from "next";
import { logoutAction } from "./login/actions";

export const metadata: Metadata = {
  title: "admin",
  robots: { index: false, follow: false },
};

export default function AdminDashboard() {
  return (
    <main className="page page-narrow">
      <section className="page-section">
        <h1 className="page-title">admin</h1>
        <ul className="tool-list">
          <li className="tool-item"><Link href="/admin/posts">→ posts</Link></li>
          <li className="tool-item"><Link href="/inspo">→ inspo</Link> <span className="post-item-date">(upload + delete pe pagina /inspo)</span></li>
          <li className="tool-item"><Link href="/admin/projects">→ projects</Link></li>
          <li className="tool-item"><Link href="/dogu">→ dogu (tools restaurant)</Link></li>
          <li className="tool-item"><Link href="/">→ înapoi pe site</Link></li>
          <li className="tool-item">
            <form action={logoutAction} style={{ display: "inline" }}>
              <button type="submit" className="btn">logout</button>
            </form>
          </li>
        </ul>
      </section>
    </main>
  );
}

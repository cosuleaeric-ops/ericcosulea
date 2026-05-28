"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const HIDDEN_ON = ["/pnlpersonal", "/elite-deux", "/admin"];

export default function AdminBarClient() {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    fetch("/api/auth-status")
      .then((r) => r.json())
      .then((d) => setAuthed(Boolean(d.loggedIn)))
      .catch(() => setAuthed(false));
  }, []);

  if (!authed) return null;

  if (pathname && HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;

  const handleLogout = () => {
    startTransition(async () => {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) {
        window.location.reload();
      }
    });
  };

  return (
    <div className="admin-bar">
      <div className="admin-bar-inner">
        <Link href="/admin">dashboard</Link>
        <Link href="/">website</Link>
        <button type="button" className="admin-bar-button" onClick={handleLogout} disabled={pending}>
          {pending ? "..." : "logout"}
        </button>
      </div>
    </div>
  );
}

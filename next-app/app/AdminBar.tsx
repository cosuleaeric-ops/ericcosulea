"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";

export default function AdminBar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/auth-status")
      .then((r) => r.json())
      .then((d) => setLoggedIn(Boolean(d.loggedIn)))
      .catch(() => setLoggedIn(false));
  }, []);

  if (!loggedIn) return null;

  const handleLogout = () => {
    startTransition(async () => {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) {
        setLoggedIn(false);
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

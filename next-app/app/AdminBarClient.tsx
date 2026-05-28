"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { isAdminBarHiddenPath, ADMIN_HINT_COOKIE } from "@/lib/admin-bar-paths";

function hasAdminHint(): boolean {
  return document.cookie.split(";").some((c) => c.trim() === `${ADMIN_HINT_COOKIE}=1`);
}

function clearAdminHint() {
  document.cookie = `${ADMIN_HINT_COOKIE}=; Max-Age=0; path=/`;
  document.documentElement.classList.remove("admin-authed");
}

function syncAdminBarClass(show: boolean) {
  document.documentElement.classList.toggle("admin-authed", show);
}

export default function AdminBarClient() {
  const pathname = usePathname();
  const hidden = pathname ? isAdminBarHiddenPath(pathname) : false;
  const [authed, setAuthed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const hinted = hasAdminHint();
    setAuthed(hinted);
    syncAdminBarClass(hinted && !hidden);

    fetch("/api/auth-status")
      .then((r) => r.json())
      .then((d) => {
        const loggedIn = Boolean(d.loggedIn);
        setAuthed(loggedIn);
        if (loggedIn) {
          syncAdminBarClass(!hidden);
        } else {
          clearAdminHint();
        }
      })
      .catch(() => {
        setAuthed(false);
        clearAdminHint();
      });
  }, [hidden]);

  if (hidden) return null;

  const handleLogout = () => {
    startTransition(async () => {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) {
        clearAdminHint();
        window.location.reload();
      }
    });
  };

  return (
    <div className="admin-bar" aria-hidden={!authed}>
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

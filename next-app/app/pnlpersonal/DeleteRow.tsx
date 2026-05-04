"use client";

import { useTransition } from "react";

export default function DeleteRow({ action, id, label }: { action: (fd: FormData) => Promise<void>; id: number; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="admin-delete-btn"
      disabled={pending}
      onClick={() => {
        if (!confirm(label)) return;
        const fd = new FormData();
        fd.set("id", String(id));
        start(() => action(fd));
      }}
    >
      ×
    </button>
  );
}

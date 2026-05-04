"use client";

import { useTransition } from "react";

export default function DeleteButton({
  action,
  id,
  confirmText,
}: {
  action: (formData: FormData) => Promise<void>;
  id: number;
  confirmText: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      style={{ display: "inline" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(confirmText)) return;
        const fd = new FormData();
        fd.set("id", String(id));
        startTransition(() => action(fd));
      }}
    >
      <button type="submit" className="admin-delete-btn" disabled={pending}>
        {pending ? "…" : "×"}
      </button>
    </form>
  );
}

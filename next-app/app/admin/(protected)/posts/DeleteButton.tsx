"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";

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
      className="inline"
      onSubmit={(e) => {
        e.preventDefault();
        if (!confirm(confirmText)) return;
        const fd = new FormData();
        fd.set("id", String(id));
        startTransition(() => action(fd));
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="șterge"
      >
        {pending ? "…" : "×"}
      </Button>
    </form>
  );
}

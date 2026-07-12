"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { deleteProjectAction, reorderProjectsAction } from "./actions";

type Project = { id: number; name: string; url: string; logo: string };

export default function ProjectsList({ initial }: { initial: Project[] }) {
  const [items, setItems] = useState(initial);
  const [dragId, setDragId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const moveOver = (overId: number) => {
    if (dragId === null || dragId === overId) return;
    setItems((prev) => {
      const from = prev.findIndex((p) => p.id === dragId);
      const to = prev.findIndex((p) => p.id === overId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const commitOrder = () => {
    if (dragId === null) return;
    setDragId(null);
    startTransition(() => reorderProjectsAction(items.map((p) => p.id)));
  };

  const handleDelete = (p: Project) => {
    if (!confirm(`Ștergi "${p.name}"?`)) return;
    const fd = new FormData();
    fd.set("id", String(p.id));
    startTransition(async () => {
      await deleteProjectAction(fd);
      setItems((prev) => prev.filter((x) => x.id !== p.id));
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((p) => (
        <Card
          key={p.id}
          draggable
          onDragStart={() => setDragId(p.id)}
          onDragOver={(e) => {
            e.preventDefault();
            moveOver(p.id);
          }}
          onDrop={(e) => e.preventDefault()}
          onDragEnd={commitOrder}
          className={cn(
            "flex-row items-center justify-between gap-4 px-3 py-3",
            dragId === p.id && "border-ring opacity-60",
          )}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/50" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.logo} alt="" className="size-[22px] rounded-md object-contain" />
            <Link href={`/admin/projects/${p.id}/edit`} className="truncate font-medium hover:underline">
              {p.name}
            </Link>
          </span>
          <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              vezi →
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => handleDelete(p)}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="șterge"
            >
              ×
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

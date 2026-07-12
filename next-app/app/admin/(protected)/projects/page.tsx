import Link from "next/link";
import type { Metadata } from "next";
import { getProjectsForHome } from "@/lib/db/queries";
import { deleteProjectAction } from "./actions";
import DeleteButton from "../posts/DeleteButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "projects - admin",
  robots: { index: false, follow: false },
};

export default async function AdminProjectsList() {
  const projects = await getProjectsForHome();

  return (
    <main className="mx-auto max-w-[820px] px-6 py-8">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
        ← admin
      </Link>
      <div className="mt-3 mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-semibold lowercase">projects</h2>
        <Button asChild>
          <Link href="/admin/projects/new">+ proiect nou</Link>
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {projects.map((p) => (
          <Card key={p.id} className="flex-row items-center justify-between gap-4 px-4 py-3">
            <span className="flex min-w-0 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.logo} alt="" className="size-[22px] rounded-md object-contain" />
              <Link href={`/admin/projects/${p.id}/edit`} className="truncate font-medium hover:underline">
                {p.name}
              </Link>
              <Badge variant="secondary">sort: {p.sort}</Badge>
            </span>
            <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
                vezi →
              </a>
              <DeleteButton action={deleteProjectAction} id={p.id} confirmText={`Ștergi "${p.name}"?`} />
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}

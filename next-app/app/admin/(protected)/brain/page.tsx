import { asc, desc } from "drizzle-orm";
import BrainApp from "@/app/brain/BrainApp";
import { db } from "@/lib/db";
import { brainPages, brainThoughts } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export default async function AdminBrainPage() {
  const [pages, thoughts] = await Promise.all([
    db.select().from(brainPages).orderBy(asc(brainPages.sort), asc(brainPages.title)),
    db.select().from(brainThoughts).orderBy(desc(brainThoughts.createdAt)),
  ]);

  return (
    <BrainApp
      initialPages={pages.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))}
      initialThoughts={thoughts.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}

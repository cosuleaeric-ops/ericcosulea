import { asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { brainPages, brainThoughts } from "@/lib/db/schema";
import BrainApp from "./BrainApp";

export const dynamic = "force-dynamic";

export default async function BrainPage() {
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

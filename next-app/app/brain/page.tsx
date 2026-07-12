import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brainPages, brainThoughts, eliteDeuxState } from "@/lib/db/schema";
import BrainApp from "./BrainApp";

export const dynamic = "force-dynamic";

type EdTask = { id: string; text: string; completed: boolean; createdAt?: number };
type EdState = { tasksByDate?: Record<string, EdTask[]> };

export default async function BrainPage() {
  const [pages, thoughts, edRows] = await Promise.all([
    db.select().from(brainPages).orderBy(asc(brainPages.sort), asc(brainPages.title)),
    db.select().from(brainThoughts).orderBy(desc(brainThoughts.createdAt)),
    db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, 1)).limit(1),
  ]);

  // Ultimele ~14 zile de task-uri din Elite Deux — clientul alege „azi" + restanțele.
  const state = (edRows[0]?.state ?? {}) as EdState;
  const byDate = state.tasksByDate ?? {};
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const recentTasks = Object.entries(byDate)
    .filter(([date]) => date >= cutoff)
    .flatMap(([date, tasks]) =>
      (tasks ?? []).map((t) => ({ date, id: t.id, text: t.text, completed: t.completed })),
    );

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
      recentTasks={recentTasks}
    />
  );
}

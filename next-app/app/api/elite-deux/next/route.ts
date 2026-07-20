import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eliteDeuxState } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROW_ID = 1;
const TZ = "Europe/Bucharest";

type Task = { id?: string; text?: string; completed?: boolean };

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function GET(req: Request) {
  const secret = process.env.ELITE_DEUX_SECRET;
  const authorized =
    (secret && req.headers.get("x-elite-secret") === secret) || (await isAuthenticated());
  if (!authorized) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  const state = rows[0]?.state as { tasksByDate?: Record<string, Task[]> } | null;
  const tasks = state?.tasksByDate?.[todayKey()] ?? [];
  const pending = tasks.filter((t) => !t.completed);
  const next = pending[0];

  return NextResponse.json({
    date: todayKey(),
    text: next?.text ?? null,
    id: next?.id ?? null,
    remaining: pending.length,
    total: tasks.length,
  });
}

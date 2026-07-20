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

async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.ELITE_DEUX_SECRET;
  if (secret && req.headers.get("x-elite-secret") === secret) return true;
  return isAuthenticated();
}

export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  const state = rows[0]?.state as { tasksByDate?: Record<string, Task[]> } | null;
  const tasks = state?.tasksByDate?.[todayKey()] ?? [];
  const next = tasks[0];

  return NextResponse.json({
    date: todayKey(),
    text: next?.text ?? null,
    id: next?.id ?? null,
    remaining: tasks.filter((t) => !t.completed).length,
    total: tasks.length,
  });
}

// Bifează primul task de azi și îl trimite la finalul listei, ca în aplicația web.
export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  const state = rows[0]?.state as { tasksByDate?: Record<string, Task[]> } | null;
  if (!state?.tasksByDate) {
    return NextResponse.json({ error: "No state" }, { status: 404 });
  }

  const key = todayKey();
  const tasks = state.tasksByDate[key] ?? [];
  const target = tasks[0];
  if (!target || target.completed) {
    return NextResponse.json({ error: "Nothing to complete" }, { status: 404 });
  }

  const rest = tasks.slice(1);
  const done = { ...target, completed: true };
  state.tasksByDate[key] = [
    ...rest.filter((t) => !t.completed),
    ...rest.filter((t) => t.completed),
    done,
  ];

  await db
    .update(eliteDeuxState)
    .set({ state, updatedAt: new Date() })
    .where(eq(eliteDeuxState.id, ROW_ID));

  return NextResponse.json({ ok: true, completed: target.text ?? null });
}

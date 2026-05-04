import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eliteDeuxState } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROW_ID = 1;

function countTasks(state: unknown): number {
  if (!state || typeof state !== "object") return 0;
  const s = state as { tasksByDate?: Record<string, unknown[]>; columns?: Array<{ days?: Array<{ tasks?: unknown[] }> }> };
  let n = 0;
  for (const arr of Object.values(s.tasksByDate ?? {})) {
    if (Array.isArray(arr)) n += arr.length;
  }
  for (const col of s.columns ?? []) {
    for (const day of col.days ?? []) {
      if (Array.isArray(day.tasks)) n += day.tasks.length;
    }
  }
  return n;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const rows = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  return NextResponse.json({ state: rows[0]?.state ?? null });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const state = (body as { state?: unknown })?.state;
  if (!state || typeof state !== "object") {
    return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
  }

  const existing = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  if (existing[0]) {
    const existingTasks = countTasks(existing[0].state);
    const newTasks = countTasks(state);
    if (existingTasks > 0 && newTasks === 0) {
      return NextResponse.json({ error: "Refusing to overwrite non-empty state with empty state" }, { status: 400 });
    }
    await db.update(eliteDeuxState).set({ state, updatedAt: new Date() }).where(eq(eliteDeuxState.id, ROW_ID));
  } else {
    await db.insert(eliteDeuxState).values({ id: ROW_ID, state, updatedAt: new Date() });
  }
  return NextResponse.json({ ok: true });
}

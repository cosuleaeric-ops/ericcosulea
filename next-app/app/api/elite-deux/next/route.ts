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
type State = {
  tasksByDate?: Record<string, Task[]>;
  lastSeenDate?: string;
  savedAt?: number;
};

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Mută taskurile restante din zilele trecute în ziua curentă, ca în aplicația web.
// Rulează la citire, deci rollover-ul se întâmplă la 00:00 chiar dacă pagina nu e deschisă.
function rolloverToToday(state: State): boolean {
  const byDate = state.tasksByDate;
  if (!byDate) return false;

  const today = todayKey();
  const past = Object.keys(byDate)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key < today)
    .sort();

  const carried: Task[] = [];
  let changed = false;

  for (const key of past) {
    const tasks = byDate[key] ?? [];
    const incomplete = tasks.filter((t) => !t.completed);
    if (incomplete.length === 0) continue;

    carried.push(...incomplete.map((t) => ({ ...t, id: uid() })));
    byDate[key] = tasks.filter((t) => t.completed);
    changed = true;
  }

  if (carried.length > 0) {
    byDate[today] = [...carried, ...(byDate[today] ?? [])];
  }

  if (state.lastSeenDate !== today) {
    state.lastSeenDate = today;
    changed = true;
  }

  return changed;
}

async function authorize(req: Request): Promise<boolean> {
  const secret = process.env.ELITE_DEUX_SECRET;
  if (secret && req.headers.get("x-elite-secret") === secret) return true;
  return isAuthenticated();
}

async function loadState(): Promise<State | null> {
  const rows = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  return (rows[0]?.state as State | undefined) ?? null;
}

async function persist(state: State): Promise<void> {
  state.savedAt = Date.now();
  await db
    .update(eliteDeuxState)
    .set({ state, updatedAt: new Date() })
    .where(eq(eliteDeuxState.id, ROW_ID));
}

export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const state = await loadState();
  if (state && rolloverToToday(state)) {
    await persist(state);
  }

  const tasks = state?.tasksByDate?.[todayKey()] ?? [];
  // Primul task nebifat; când tot e bifat, topbar-ul arată un mesaj, nu ultimul task făcut.
  const next = tasks.find((t) => !t.completed);

  return NextResponse.json({
    date: todayKey(),
    text: next?.text ?? null,
    id: next?.id ?? null,
    remaining: tasks.filter((t) => !t.completed).length,
    total: tasks.length,
  });
}

// Bifează primul task nebifat de azi și îl trimite la finalul listei, ca în aplicația web.
export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const state = await loadState();
  if (!state?.tasksByDate) {
    return NextResponse.json({ error: "No state" }, { status: 404 });
  }
  rolloverToToday(state);

  const key = todayKey();
  const tasks = state.tasksByDate[key] ?? [];
  const idx = tasks.findIndex((t) => !t.completed);
  if (idx === -1) {
    return NextResponse.json({ error: "Nothing to complete" }, { status: 404 });
  }

  const target = tasks[idx];
  const rest = tasks.filter((_, i) => i !== idx);
  const done = { ...target, completed: true };
  state.tasksByDate[key] = [
    ...rest.filter((t) => !t.completed),
    ...rest.filter((t) => t.completed),
    done,
  ];

  await persist(state);

  return NextResponse.json({ ok: true, completed: target.text ?? null });
}

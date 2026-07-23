import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eliteDeuxState } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pin-ul topbar-ului macOS trăiește acum LOCAL (app web → server local 127.0.0.1
// din elitedeux-menubar), ca nimic să nu interogheze Neon în fundal. Ruta asta
// mai face un singur lucru: butonul „Done” din topbar marchează task-ul pinuit
// complet — un POST cu {id}, la click, nu polling.

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
function rolloverToToday(state: State): void {
  const byDate = state.tasksByDate;
  if (!byDate) return;

  const today = todayKey();
  const past = Object.keys(byDate)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key < today)
    .sort();

  const carried: Task[] = [];
  for (const key of past) {
    const tasks = byDate[key] ?? [];
    const incomplete = tasks.filter((t) => !t.completed);
    if (incomplete.length === 0) continue;
    carried.push(...incomplete.map((t) => ({ ...t, id: uid() })));
    byDate[key] = tasks.filter((t) => t.completed);
  }
  if (carried.length > 0) {
    byDate[today] = [...carried, ...(byDate[today] ?? [])];
  }
  state.lastSeenDate = today;
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

async function persistState(state: State): Promise<void> {
  state.savedAt = Date.now();
  await db
    .update(eliteDeuxState)
    .set({ state, updatedAt: new Date() })
    .where(eq(eliteDeuxState.id, ROW_ID));
}

function findTask(state: State, id: string): { task: Task; dateKey: string } | null {
  for (const [dateKey, tasks] of Object.entries(state.tasksByDate ?? {})) {
    const task = (tasks ?? []).find((t) => t.id === id);
    if (task) return { task, dateKey };
  }
  return null;
}

// Bifează task-ul cu id-ul dat (butonul Done din topbar) și îl trimite la
// finalul listei zilei lui, ca în aplicația web.
export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { id?: string };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const id = body.id;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const state = await loadState();
  if (!state?.tasksByDate) {
    return NextResponse.json({ error: "No state" }, { status: 404 });
  }
  rolloverToToday(state);

  const found = findTask(state, id);
  if (!found || found.task.completed) {
    return NextResponse.json({ error: "Nothing to complete" }, { status: 404 });
  }

  const tasks = state.tasksByDate[found.dateKey] ?? [];
  const rest = tasks.filter((t) => t.id !== id);
  const done = { ...found.task, completed: true };
  state.tasksByDate[found.dateKey] = [
    ...rest.filter((t) => !t.completed),
    ...rest.filter((t) => t.completed),
    done,
  ];

  await persistState(state);
  return NextResponse.json({ ok: true, completed: found.task.text ?? null });
}

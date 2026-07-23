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
// Task-ul pinuit manual din app (butonul 📌). Topbar-ul arată DOAR asta —
// nu mai există logică automată de „primul task nebifat".
type TopbarPin = { id: string; text: string } | null;

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
// Rulează la citire, deci rollover-ul se întâmplă la primul refresh de după 00:00.
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

async function loadRow(): Promise<{ state: State | null; topbar: TopbarPin }> {
  const rows = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  return {
    state: (rows[0]?.state as State | undefined) ?? null,
    topbar: (rows[0]?.topbar as TopbarPin | undefined) ?? null,
  };
}

async function persistState(state: State): Promise<void> {
  state.savedAt = Date.now();
  await db
    .update(eliteDeuxState)
    .set({ state, updatedAt: new Date() })
    .where(eq(eliteDeuxState.id, ROW_ID));
}

async function persistTopbar(topbar: TopbarPin): Promise<void> {
  await db
    .update(eliteDeuxState)
    .set({ topbar, updatedAt: new Date() })
    .where(eq(eliteDeuxState.id, ROW_ID));
}

// Caută task-ul pinuit în orice zi (pin-ul poate fi pe azi sau pe o zi viitoare).
function findTask(state: State, id: string): { task: Task; dateKey: string } | null {
  for (const [dateKey, tasks] of Object.entries(state.tasksByDate ?? {})) {
    const task = (tasks ?? []).find((t) => t.id === id);
    if (task) return { task, dateKey };
  }
  return null;
}

export async function GET(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { state, topbar } = await loadRow();
  if (state && rolloverToToday(state)) {
    await persistState(state);
  }

  const tasks = state?.tasksByDate?.[todayKey()] ?? [];

  // Pin-ul e valid doar cât timp task-ul există și e nebifat; altfel se consumă.
  // (La rollover-ul de la 00:00 task-urile restante primesc id nou → pin-ul vechi
  // se golește singur aici.)
  let pin = topbar;
  if (pin && state) {
    const found = findTask(state, pin.id);
    if (!found || found.task.completed) {
      pin = null;
      await persistTopbar(null);
    } else if (found.task.text && found.task.text !== pin.text) {
      pin = { id: pin.id, text: found.task.text }; // textul editat în app
      await persistTopbar(pin);
    }
  }

  return NextResponse.json({
    date: todayKey(),
    text: pin?.text ?? null,
    id: pin?.id ?? null,
    pinned: pin !== null,
    remaining: tasks.filter((t) => !t.completed).length,
    total: tasks.length,
  });
}

// Pin/unpin din app (butonul 📌 de pe task). Același id de două ori = unpin.
export async function PUT(req: Request) {
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

  const { state, topbar } = await loadRow();
  if (!state?.tasksByDate) {
    return NextResponse.json({ error: "No state" }, { status: 404 });
  }

  if (topbar?.id === id) {
    await persistTopbar(null);
    return NextResponse.json({ ok: true, pinned: false });
  }

  const found = findTask(state, id);
  if (!found || found.task.completed) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await persistTopbar({ id, text: found.task.text ?? "" });
  return NextResponse.json({ ok: true, pinned: true, text: found.task.text ?? "" });
}

// Bifează task-ul pinuit (butonul Done din topbar) și consumă pin-ul.
export async function POST(req: Request) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { state, topbar } = await loadRow();
  if (!state?.tasksByDate || !topbar) {
    return NextResponse.json({ error: "Nothing pinned" }, { status: 404 });
  }
  rolloverToToday(state);

  const found = findTask(state, topbar.id);
  if (!found || found.task.completed) {
    await persistTopbar(null);
    return NextResponse.json({ error: "Nothing to complete" }, { status: 404 });
  }

  // Bifat + trimis la finalul listei zilei lui, ca în aplicația web.
  const tasks = state.tasksByDate[found.dateKey] ?? [];
  const rest = tasks.filter((t) => t.id !== topbar.id);
  const done = { ...found.task, completed: true };
  state.tasksByDate[found.dateKey] = [
    ...rest.filter((t) => !t.completed),
    ...rest.filter((t) => t.completed),
    done,
  ];

  await persistState(state);
  await persistTopbar(null);

  return NextResponse.json({ ok: true, completed: found.task.text ?? null });
}

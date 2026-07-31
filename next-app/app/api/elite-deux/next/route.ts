import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, sqlQuery } from "@/lib/db";
import { eliteDeuxState } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";
import { createWipTodo, hasProjectTag, wipEnabled } from "@/lib/wip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROW_ID = 1;
const TZ = "Europe/Bucharest";

type Task = {
  id?: string;
  text?: string;
  completed?: boolean;
  createdAt?: number;
  seriesId?: string;
  // Id-ul todo-ului de pe WIP, dacă a fost publicat. Prezența lui împiedică
  // republicarea când debifezi și bifezi din nou.
  wipId?: string;
};
type Recurrence = {
  id: string;
  text: string;
  everyN: number;
  unit: "day" | "week" | "month";
  startDate: string;
  materialized?: string[];
};
type State = {
  tasksByDate?: Record<string, Task[]>;
  recurring?: Recurrence[];
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

// Oglinda logicii din public/elite-deux/app.js — cele două trebuie ținute sincron.
// Datele sunt parsate în UTC ca diferența de zile să fie exactă (fără ora de vară).
function parseKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function isRecurrenceDue(rule: Recurrence, dateKey: string): boolean {
  const start = parseKey(rule.startDate);
  const date = parseKey(dateKey);
  if (!start || !date || date < start) return false;

  const everyN = Math.max(1, Math.round(Number(rule.everyN) || 1));

  if (rule.unit === "month") {
    const months =
      (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (date.getUTCMonth() - start.getUTCMonth());
    if (months < 0 || months % everyN !== 0) return false;

    // Aceeași zi din lună, retezată la lunile mai scurte: 31 ian → 28 feb.
    const lastDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
    ).getUTCDate();
    return date.getUTCDate() === Math.min(start.getUTCDate(), lastDay);
  }

  const step = rule.unit === "week" ? everyN * 7 : everyN;
  const days = Math.round((date.getTime() - start.getTime()) / 86400000);
  return days >= 0 && days % step === 0;
}

// Are vreo regulă o instanță de generat azi? Rulează la fiecare cerere, deci e
// doar JS pe câteva reguli — evită să încărcăm tot blob-ul degeaba.
function needsRecurring(rules: Recurrence[] | null, dateKey: string): boolean {
  if (!Array.isArray(rules)) return false;
  return rules.some(
    (rule) =>
      !(Array.isArray(rule.materialized) ? rule.materialized : []).includes(dateKey) &&
      isRecurrenceDue(rule, dateKey),
  );
}

function materializeRecurring(state: State, dateKey: string): boolean {
  const rules = state.recurring;
  if (!Array.isArray(rules) || rules.length === 0) return false;

  let changed = false;

  for (const rule of rules) {
    // Zilele trecute nu se mai generează, deci nu mai trebuie ținute minte.
    // Curățarea singură nu declanșează scriere — se salvează cu următoarea schimbare.
    const seen = (Array.isArray(rule.materialized) ? rule.materialized : []).filter(
      (key) => key >= dateKey,
    );
    rule.materialized = seen;

    if (seen.includes(dateKey) || !isRecurrenceDue(rule, dateKey)) continue;

    // Marcăm ziua înainte de orice ieșire: dacă ștergi instanța, nu reapare.
    seen.push(dateKey);
    changed = true;

    if (!state.tasksByDate) state.tasksByDate = {};
    const tasks = state.tasksByDate[dateKey] ?? [];
    if (tasks.some((t) => t.seriesId === rule.id)) continue;

    const entry: Task = {
      id: uid(),
      text: rule.text,
      completed: false,
      createdAt: Date.now(),
      seriesId: rule.id,
    };
    const firstCompleted = tasks.findIndex((t) => t.completed);
    state.tasksByDate[dateKey] =
      firstCompleted === -1
        ? [...tasks, entry]
        : [...tasks.slice(0, firstCompleted), entry, ...tasks.slice(firstCompleted)];
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

  const today = todayKey();

  // Topbar-ul întreabă la 2 secunde. Nu încărcăm tot blob-ul de stare (~24 kB,
  // tot istoricul) ca să scoatem din el o singură zi — lăsăm Postgres să extragă
  // doar ziua curentă (~sute de octeți). Altfel: ~1 GB/zi de egress degeaba.
  const rows = await sqlQuery<{
    today: Task[] | null;
    last_seen: string | null;
    recurring: Recurrence[] | null;
  }>(
    `SELECT state->'tasksByDate'->$2 AS today,
            state->>'lastSeenDate'   AS last_seen,
            state->'recurring'       AS recurring
       FROM elite_deux_state WHERE id = $1`,
    [ROW_ID, today],
  );

  let tasks: Task[];
  if (rows.length === 0) {
    tasks = [];
  } else if (rows[0].last_seen === today && !needsRecurring(rows[0].recurring, today)) {
    // Cazul normal: ziua e deja curentă și recurențele de azi sunt deja generate.
    tasks = Array.isArray(rows[0].today) ? rows[0].today : [];
  } else {
    // Zi nouă (prima interogare după miezul nopții) sau o regulă recurentă care
    // pică azi: abia acum citim tot, mutăm restanțele, generăm instanțele și
    // salvăm. O dată pe zi, nu la fiecare 2 secunde.
    const state = await loadState();
    if (state) {
      const rolled = rolloverToToday(state);
      const generated = materializeRecurring(state, today);
      if (rolled || generated) {
        await persist(state);
      }
    }
    tasks = state?.tasksByDate?.[today] ?? [];
  }

  // Primul task nebifat; când tot e bifat, topbar-ul arată un mesaj, nu ultimul task făcut.
  const next = tasks.find((t) => !t.completed);

  return NextResponse.json({
    date: today,
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
  materializeRecurring(state, key);

  const tasks = state.tasksByDate[key] ?? [];
  const idx = tasks.findIndex((t) => !t.completed);
  if (idx === -1) {
    return NextResponse.json({ error: "Nothing to complete" }, { status: 404 });
  }

  const target = tasks[idx];
  const rest = tasks.filter((_, i) => i !== idx);

  // Bifat din menubar: dacă are #proiect și n-a fost deja publicat, ajunge pe WIP.
  // O eroare de la WIP nu are voie să blocheze bifarea.
  let wipId = target.wipId;
  if (!wipId && wipEnabled() && hasProjectTag(target.text ?? "")) {
    try {
      wipId = (await createWipTodo(target.text!)).id;
    } catch (error) {
      console.warn("WIP post failed", error);
    }
  }

  const done: Task = { ...target, completed: true, ...(wipId ? { wipId } : {}) };
  state.tasksByDate[key] = [
    ...rest.filter((t) => !t.completed),
    ...rest.filter((t) => t.completed),
    done,
  ];

  await persist(state);

  return NextResponse.json({ ok: true, completed: target.text ?? null });
}

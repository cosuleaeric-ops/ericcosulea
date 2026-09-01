import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { eliteDeuxState } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROW_ID = 1;

// `no-cache` (nu `no-store`): browserul păstrează corpul și revalidează cu
// If-None-Match, deci un răspuns neschimbat costă 304, nu 30 kB.
const CACHE_HEADERS = (etag: string) => ({
  ETag: etag,
  "Cache-Control": "private, no-cache, must-revalidate",
});

// Doar marcajul de timp — nu atinge blob-ul de stare.
async function currentVersion(): Promise<number> {
  const rows = await db
    .select({ updatedAt: eliteDeuxState.updatedAt })
    .from(eliteDeuxState)
    .where(eq(eliteDeuxState.id, ROW_ID))
    .limit(1);
  return rows[0]?.updatedAt?.getTime() ?? 0;
}

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

type StatePayload = Record<string, unknown>;

function statePayload(value: unknown): StatePayload {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as StatePayload)
    : {};
}

function recurringUpdatedAt(state: StatePayload): number {
  const value = Number(state.recurringUpdatedAt);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// Un tab/dispozitiv vechi poate salva întregul blob fără regulile primite între
// timp. Recurențele au propria versiune, astfel încât o salvare veche nu le poate
// goli; o adăugare sau ștergere explicită din client crește această versiune.
function preserveNewerRecurring(existing: unknown, incoming: StatePayload): StatePayload {
  const current = statePayload(existing);
  const currentUpdatedAt = recurringUpdatedAt(current);
  const incomingUpdatedAt = recurringUpdatedAt(incoming);
  const currentRecurring = Array.isArray(current.recurring) ? current.recurring : [];
  const incomingRecurring = Array.isArray(incoming.recurring) ? incoming.recurring : [];
  const preserveLegacyRules =
    currentUpdatedAt === 0 &&
    incomingUpdatedAt === 0 &&
    currentRecurring.length > 0 &&
    incomingRecurring.length === 0;

  if (currentUpdatedAt > incomingUpdatedAt || preserveLegacyRules) {
    return {
      ...incoming,
      recurring: currentRecurring,
      recurringUpdatedAt: currentUpdatedAt,
    };
  }

  return incoming;
}

function recurringResponse(state: StatePayload) {
  return {
    recurring: Array.isArray(state.recurring) ? state.recurring : [],
    recurringUpdatedAt: recurringUpdatedAt(state),
  };
}

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // `?only=version` întoarce doar marcajul de timp (zeci de octeți), ca poll-ul
  // clientului să nu mai descarce tot blob-ul de stare (~30 kB) la fiecare 3s —
  // asta consuma singură ~6 GB de egress pe lună.
  // `build` e amprenta deploy-ului: clientul o compară cu a lui și se reîncarcă
  // singur când diferă, ca un tab vechi să nu ruleze la nesfârșit cod de dinainte
  // de un fix.
  if (new URL(req.url).searchParams.get("only") === "version") {
    return NextResponse.json({
      version: await currentVersion(),
      build: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    });
  }

  // Plasă de siguranță peste verificarea de versiune a clientului: chiar dacă
  // aceea se strică din nou, un poll repetat costă un 304 gol în loc de 30 kB.
  // Citim întâi doar `updated_at`, deci nici DB-ul nu atinge blob-ul degeaba.
  const etag = `W/"${await currentVersion()}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: CACHE_HEADERS(etag) });
  }

  const rows = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  return NextResponse.json(
    {
      state: rows[0]?.state ?? null,
      version: rows[0]?.updatedAt?.getTime() ?? 0,
    },
    { headers: CACHE_HEADERS(etag) },
  );
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
  const rawState = (body as { state?: unknown })?.state;
  if (!rawState || typeof rawState !== "object" || Array.isArray(rawState)) {
    return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
  }
  const incomingState = rawState as StatePayload;

  const existing = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, ROW_ID)).limit(1);
  const updatedAt = new Date();
  const state = preserveNewerRecurring(existing[0]?.state, incomingState);
  if (existing[0]) {
    const existingTasks = countTasks(existing[0].state);
    const newTasks = countTasks(state);
    if (existingTasks > 0 && newTasks === 0) {
      return NextResponse.json({ error: "Refusing to overwrite non-empty state with empty state" }, { status: 400 });
    }
    await db.update(eliteDeuxState).set({ state, updatedAt }).where(eq(eliteDeuxState.id, ROW_ID));
  } else {
    await db.insert(eliteDeuxState).values({ id: ROW_ID, state, updatedAt });
  }
  // Versiunea rezultată — clientul o reține ca să nu redescarce ce tocmai a scris.
  return NextResponse.json({ ok: true, version: updatedAt.getTime(), ...recurringResponse(state) });
}

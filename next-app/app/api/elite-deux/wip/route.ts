import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/session";
import { createWipTodo, hasProjectTag, wipEnabled } from "@/lib/wip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Publică pe WIP un task bifat din aplicația web. Nu atinge starea Elite Deux —
// clientul primește id-ul înapoi și îl salvează el, ca să nu ne batem cu
// salvarea lui debounce-uită pe același blob.
export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!wipEnabled()) {
    return NextResponse.json({ error: "WIP not configured" }, { status: 503 });
  }

  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  // Aceeași regulă ca în client: fără #proiect nu se publică nimic.
  if (!hasProjectTag(text)) {
    return NextResponse.json({ error: "No project tag" }, { status: 400 });
  }

  try {
    const todo = await createWipTodo(text.trim());
    return NextResponse.json({ ok: true, id: todo.id, url: todo.url });
  } catch (error) {
    console.warn("WIP post failed", error);
    return NextResponse.json({ error: "WIP request failed" }, { status: 502 });
  }
}

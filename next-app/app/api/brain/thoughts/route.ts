import { addThought, brainAuthorized, getAllThoughts } from "@/lib/brain";

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(
    raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean),
  )];
}

export async function GET(request: Request) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  return Response.json({ thoughts: await getAllThoughts() });
}

export async function POST(request: Request) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const contentMd = typeof body?.contentMd === "string" ? body.contentMd.trim() : "";
  if (!contentMd) return Response.json({ error: "contentMd lipsă" }, { status: 400 });
  const thought = await addThought(contentMd, cleanTags(body.tags));
  return Response.json({ thought });
}

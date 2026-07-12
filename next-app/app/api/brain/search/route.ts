import { brainAuthorized, searchBrain } from "@/lib/brain";

export async function GET(request: Request) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ error: "q lipsă" }, { status: 400 });
  return Response.json(await searchBrain(q));
}

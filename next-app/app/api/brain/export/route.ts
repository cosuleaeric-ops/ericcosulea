import { brainAuthorized, buildExport } from "@/lib/brain";

// Dump-ul complet al creierului în markdown — citit de Claude Code înainte de decizii.
export async function GET(request: Request) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  return new Response(await buildExport(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Colector server-side pentru crawlere AI — DEZACTIVAT (iul 2026).
// Crawlerele lovesc site-urile non-stop și fiecare hit scria în Neon, deci
// compute-ul free (autosuspend 5 min) nu adormea niciodată. Endpoint-ul
// răspunde în continuare 202 ca middleware-urile site-urilor care încă trimit
// beacon-uri (ex. cesaicumpar) să nu primească erori. Istoricul rămâne în
// crawler_events; implementarea veche e în git.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST() {
  return NextResponse.json({ ok: true }, { status: 202, headers: CORS });
}

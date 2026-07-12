import { db } from "@/lib/db";
import { brainPages } from "@/lib/db/schema";
import { brainAuthorized, getAllPages, uniqueSlug } from "@/lib/brain";

export async function GET(request: Request) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  return Response.json({ pages: await getAllPages() });
}

export async function POST(request: Request) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return Response.json({ error: "title lipsă" }, { status: 400 });

  const rows = await db
    .insert(brainPages)
    .values({
      slug: await uniqueSlug(title),
      title,
      parentId: typeof body.parentId === "number" ? body.parentId : null,
      description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : null,
      icon: typeof body.icon === "string" && body.icon.trim() ? body.icon.trim() : null,
      contentMd: typeof body.contentMd === "string" ? body.contentMd : "",
    })
    .returning();
  return Response.json({ page: rows[0] });
}

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brainPages } from "@/lib/db/schema";
import { brainAuthorized } from "@/lib/brain";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "id invalid" }, { status: 400 });
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "body invalid" }, { status: 400 });

  const set: Partial<typeof brainPages.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === "string" && body.title.trim()) set.title = body.title.trim();
  if ("description" in body) set.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if ("icon" in body) set.icon = typeof body.icon === "string" && body.icon.trim() ? body.icon.trim() : null;
  if (typeof body.contentMd === "string") set.contentMd = body.contentMd;
  if ("parentId" in body) set.parentId = typeof body.parentId === "number" ? body.parentId : null;
  if (typeof body.sort === "number") set.sort = body.sort;

  const rows = await db.update(brainPages).set(set).where(eq(brainPages.id, id)).returning();
  if (!rows[0]) return Response.json({ error: "inexistent" }, { status: 404 });
  return Response.json({ page: rows[0] });
}

export async function DELETE(request: Request, ctx: Ctx) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "id invalid" }, { status: 400 });
  const children = await db.select({ id: brainPages.id }).from(brainPages).where(eq(brainPages.parentId, id)).limit(1);
  if (children.length) {
    return Response.json({ error: "are subpagini — șterge-le sau mută-le întâi" }, { status: 400 });
  }
  await db.delete(brainPages).where(eq(brainPages.id, id));
  return Response.json({ ok: true });
}

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { brainThoughts } from "@/lib/db/schema";
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

  const set: Partial<typeof brainThoughts.$inferInsert> = {};
  if (typeof body.contentMd === "string" && body.contentMd.trim()) set.contentMd = body.contentMd.trim();
  if (Array.isArray(body.tags)) {
    set.tags = [...new Set(
      (body.tags as unknown[])
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean),
    )];
  }
  if (!Object.keys(set).length) return Response.json({ error: "nimic de actualizat" }, { status: 400 });

  const rows = await db.update(brainThoughts).set(set).where(eq(brainThoughts.id, id)).returning();
  if (!rows[0]) return Response.json({ error: "inexistent" }, { status: 404 });
  return Response.json({ thought: rows[0] });
}

export async function DELETE(request: Request, ctx: Ctx) {
  if (!(await brainAuthorized(request))) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "id invalid" }, { status: 400 });
  await db.delete(brainThoughts).where(eq(brainThoughts.id, id));
  return Response.json({ ok: true });
}

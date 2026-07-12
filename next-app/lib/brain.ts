import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { brainPages, brainThoughts } from "@/lib/db/schema";
import { isAuthenticated } from "@/lib/session";

export type BrainPage = typeof brainPages.$inferSelect;
export type BrainThought = typeof brainThoughts.$inferSelect;

// Acces: sesiune admin (UI) sau BRAIN_SECRET (Claude Code / scripturi).
export async function brainAuthorized(req: Request): Promise<boolean> {
  const secret = process.env.BRAIN_SECRET;
  if (secret && req.headers.get("x-brain-secret") === secret) return true;
  return isAuthenticated();
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "pagina"
  );
}

export async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  const taken = new Set(
    (
      await db
        .select({ slug: brainPages.slug })
        .from(brainPages)
        .where(ilike(brainPages.slug, `${base}%`))
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export async function getAllPages(): Promise<BrainPage[]> {
  return db
    .select()
    .from(brainPages)
    .orderBy(asc(brainPages.sort), asc(brainPages.title));
}

export async function getAllThoughts(): Promise<BrainThought[]> {
  return db.select().from(brainThoughts).orderBy(desc(brainThoughts.createdAt));
}

function pagePath(page: BrainPage, byId: Map<number, BrainPage>): string {
  const parts = [page.title];
  let p = page.parentId ? byId.get(page.parentId) : undefined;
  while (p) {
    parts.unshift(p.title);
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return parts.join(" › ");
}

// Dump compact în markdown — contextul pe care AI-ul îl citește înainte de decizii.
export async function buildExport(): Promise<string> {
  const [pages, thoughts] = await Promise.all([getAllPages(), getAllThoughts()]);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const lines: string[] = ["# Second Brain — export complet", ""];

  lines.push("## Pages", "");
  const walk = (parentId: number | null, depth: number) => {
    for (const p of pages.filter((x) => x.parentId === parentId)) {
      lines.push(`${"#".repeat(Math.min(depth + 2, 6))} ${pagePath(p, byId)}  [slug: ${p.slug}]`);
      if (p.description) lines.push(`*${p.description}*`);
      if (p.contentMd.trim()) lines.push("", p.contentMd.trim());
      lines.push("");
      walk(p.id, depth + 1);
    }
  };
  walk(null, 1);

  lines.push("## Thoughts (cele mai noi primele)", "");
  for (const t of thoughts) {
    const date = t.createdAt.toISOString().slice(0, 16).replace("T", " ");
    const tags = t.tags.length ? ` [${t.tags.map((x) => `#${x}`).join(" ")}]` : "";
    lines.push(`- ${date}${tags}: ${t.contentMd.replace(/\n+/g, " ").trim()}`);
  }
  return lines.join("\n");
}

export async function searchBrain(query: string) {
  const q = `%${query}%`;
  const [pages, thoughts] = await Promise.all([
    db
      .select()
      .from(brainPages)
      .where(
        or(
          ilike(brainPages.title, q),
          ilike(brainPages.contentMd, q),
          ilike(brainPages.description, q),
        ),
      ),
    db
      .select()
      .from(brainThoughts)
      .where(
        or(
          ilike(brainThoughts.contentMd, q),
          sql`${brainThoughts.tags}::text ilike ${q}`,
        ),
      )
      .orderBy(desc(brainThoughts.createdAt)),
  ]);
  return { pages, thoughts };
}

export async function addThought(contentMd: string, tags: string[]): Promise<BrainThought> {
  const rows = await db
    .insert(brainThoughts)
    .values({ contentMd, tags })
    .returning();
  return rows[0];
}

// Upsert după slug — folosit de MCP ca AI-ul să poată nota decizii/actualizări.
export async function upsertPage(input: {
  slug?: string;
  title: string;
  contentMd?: string;
  description?: string;
  parentSlug?: string;
}): Promise<BrainPage> {
  let parentId: number | null = null;
  if (input.parentSlug) {
    const parent = await db
      .select()
      .from(brainPages)
      .where(eq(brainPages.slug, input.parentSlug))
      .limit(1);
    if (!parent[0]) throw new Error(`parent_slug inexistent: ${input.parentSlug}`);
    parentId = parent[0].id;
  }
  if (input.slug) {
    const existing = await db
      .select()
      .from(brainPages)
      .where(eq(brainPages.slug, input.slug))
      .limit(1);
    if (existing[0]) {
      const rows = await db
        .update(brainPages)
        .set({
          title: input.title,
          ...(input.contentMd !== undefined ? { contentMd: input.contentMd } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.parentSlug !== undefined ? { parentId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(brainPages.id, existing[0].id))
        .returning();
      return rows[0];
    }
  }
  const rows = await db
    .insert(brainPages)
    .values({
      slug: input.slug ?? (await uniqueSlug(input.title)),
      title: input.title,
      contentMd: input.contentMd ?? "",
      description: input.description ?? null,
      parentId,
    })
    .returning();
  return rows[0];
}

import {
  addThought,
  buildExport,
  getAllPages,
  getAllThoughts,
  searchBrain,
  upsertPage,
} from "@/lib/brain";
import { db } from "@/lib/db";
import { brainPages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Server MCP minimal (streamable HTTP, stateless, doar tools) pentru claude.ai.
// Auth: Authorization Bearer sau ?key= (claude.ai custom connectors nu pot seta headere).

function authorized(request: Request): boolean {
  const secret = process.env.BRAIN_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("key") === secret;
}

const TOOLS = [
  {
    name: "brain_overview",
    description:
      "Vedere de ansamblu a second brain-ului lui Eric: arborele de pagini (slug, titlu, descriere), tagurile și ultimele 10 gânduri. Apeleaz-o prima ca să știi ce există.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "brain_read_page",
    description: "Citește conținutul complet (markdown) al unei pagini din brain, după slug.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Slug-ul paginii (din brain_overview)" } },
      required: ["slug"],
    },
  },
  {
    name: "brain_search",
    description: "Caută în toate paginile și gândurile din brain (titluri, conținut, taguri).",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "brain_export",
    description:
      "Exportă tot creierul ca markdown (toate paginile + toate gândurile). Folosește-l când o decizie trebuie luată prin prisma întregului context.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "brain_add_thought",
    description:
      "Adaugă un gând nou în stream-ul cronologic (idee, decizie luată, observație). Taguri lowercase fără #.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Textul gândului (markdown)" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["content"],
    },
  },
  {
    name: "brain_write_page",
    description:
      "Creează sau actualizează (upsert după slug) o pagină din brain. Folosește doar la cererea explicită a lui Eric.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        slug: { type: "string", description: "Dacă există, pagina e actualizată; altfel e creată" },
        content: { type: "string", description: "Conținut markdown (înlocuiește tot conținutul)" },
        description: { type: "string" },
        parent_slug: { type: "string" },
      },
      required: ["title"],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "brain_overview": {
      const [pages, thoughts] = await Promise.all([getAllPages(), getAllThoughts()]);
      const lines: string[] = ["PAGES:"];
      const walk = (parentId: number | null, depth: number) => {
        for (const p of pages.filter((x) => x.parentId === parentId)) {
          const desc = p.description ? ` — ${p.description}` : "";
          lines.push(`${"  ".repeat(depth)}- [${p.slug}] ${p.title}${desc}`);
          walk(p.id, depth + 1);
        }
      };
      walk(null, 0);
      const tagCount = new Map<string, number>();
      for (const t of thoughts) for (const tag of t.tags) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
      lines.push("", "TAGS: " + [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `#${t}(${n})`).join(" "));
      lines.push("", `THOUGHTS (ultimele 10 din ${thoughts.length}):`);
      for (const t of thoughts.slice(0, 10)) {
        const tags = t.tags.length ? ` [${t.tags.map((x) => `#${x}`).join(" ")}]` : "";
        lines.push(`- ${t.createdAt.toISOString().slice(0, 10)}${tags}: ${t.contentMd.replace(/\n+/g, " ").slice(0, 200)}`);
      }
      return lines.join("\n");
    }
    case "brain_read_page": {
      const slug = String(args.slug ?? "");
      const rows = await db.select().from(brainPages).where(eq(brainPages.slug, slug)).limit(1);
      if (!rows[0]) return `Pagina cu slug "${slug}" nu există.`;
      const p = rows[0];
      return `# ${p.title}\n${p.description ? `*${p.description}*\n` : ""}\n${p.contentMd || "(pagină goală)"}`;
    }
    case "brain_search": {
      const { pages, thoughts } = await searchBrain(String(args.query ?? ""));
      if (!pages.length && !thoughts.length) return "Niciun rezultat.";
      const lines: string[] = [];
      for (const p of pages) lines.push(`PAGE [${p.slug}] ${p.title}${p.description ? ` — ${p.description}` : ""}`);
      for (const t of thoughts) {
        const tags = t.tags.length ? ` [${t.tags.map((x) => `#${x}`).join(" ")}]` : "";
        lines.push(`THOUGHT ${t.createdAt.toISOString().slice(0, 10)}${tags}: ${t.contentMd.replace(/\n+/g, " ").slice(0, 300)}`);
      }
      return lines.join("\n");
    }
    case "brain_export":
      return buildExport();
    case "brain_add_thought": {
      const content = String(args.content ?? "").trim();
      if (!content) return "Eroare: content gol.";
      const tags = Array.isArray(args.tags)
        ? [...new Set(args.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))]
        : [];
      const t = await addThought(content, tags);
      return `Gând salvat (id ${t.id}).`;
    }
    case "brain_write_page": {
      const p = await upsertPage({
        title: String(args.title ?? "").trim(),
        slug: typeof args.slug === "string" ? args.slug : undefined,
        contentMd: typeof args.content === "string" ? args.content : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
        parentSlug: typeof args.parent_slug === "string" ? args.parent_slug : undefined,
      });
      return `Pagină salvată: [${p.slug}] ${p.title}`;
    }
    default:
      throw new Error(`Tool necunoscut: ${name}`);
  }
}

type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: number | string | null | undefined, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: number | string | null | undefined, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return rpcError(null, -32001, "unauthorized", 401);
  }
  let msg: JsonRpcMessage;
  try {
    msg = await request.json();
  } catch {
    return rpcError(null, -32700, "parse error", 400);
  }

  if (msg.method?.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  switch (msg.method) {
    case "initialize":
      return rpcResult(msg.id, {
        protocolVersion: (msg.params?.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "brain", title: "Second Brain — Eric", version: "1.0.0" },
      });
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const text = await callTool(name, args);
        return rpcResult(msg.id, { content: [{ type: "text", text }], isError: false });
      } catch (err) {
        return rpcResult(msg.id, {
          content: [{ type: "text", text: `Eroare: ${err instanceof Error ? err.message : String(err)}` }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(msg.id, -32601, `method necunoscut: ${msg.method}`);
  }
}

// Fără stream SSE server→client (server stateless, doar tools).
export async function GET() {
  return new Response(null, { status: 405 });
}

export async function DELETE() {
  return new Response(null, { status: 405 });
}

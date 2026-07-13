import { desc, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { cheltuieli, portofel, venituri } from "@/lib/db/schema";
import { upsertPage } from "@/lib/brain";

// Sincronizează săptămânal cifrele volatile în brain (pagina „stadiu-live"),
// ca AI-ul (inclusiv claude.ai prin MCP) să vadă mereu starea reală a proiectelor.
// Rulat de cron-ul Vercel (Authorization: Bearer CRON_SECRET) sau manual cu x-brain-secret.

export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const cron = process.env.CRON_SECRET;
  if (cron && request.headers.get("authorization") === `Bearer ${cron}`) return true;
  const brain = process.env.BRAIN_SECRET;
  return Boolean(brain && request.headers.get("x-brain-secret") === brain);
}

type OutglowProfile = {
  email: string | null;
  plan: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
};

async function outglowStats() {
  const url = process.env.OUTGLOW_SUPABASE_URL;
  const key = process.env.OUTGLOW_SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const profiles: OutglowProfile[] = await fetch(
    `${url}/rest/v1/profiles?select=email,plan,stripe_subscription_id,created_at`,
    { headers, cache: "no-store" },
  ).then((r) => r.json());

  const count = async (table: string) => {
    const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
      method: "HEAD",
      headers: { ...headers, Prefer: "count=exact" },
      cache: "no-store",
    });
    return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
  };

  const owners = (process.env.OUTGLOW_OWNER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const real = profiles.filter((p) => !owners.includes((p.email ?? "").toLowerCase()));
  const d30 = Date.now() - 30 * 86400000;

  return {
    users: real.length,
    paying: real.filter((p) => p.stripe_subscription_id).length,
    signups30d: real.filter((p) => new Date(p.created_at).getTime() > d30).length,
    projects: await count("projects"),
    audits: await count("audits"),
  };
}

type ClpRow = { data: string; suma: number; categorie?: string | null };

// P&L-ul CLP live, prin sync-export-ul de pe cursurilapahar.ro (token, nu sesiune).
async function clpStats() {
  const url = process.env.CLP_SYNC_URL;
  const token = process.env.CLP_SYNC_TOKEN;
  if (!url || !token) return null;
  try {
    const bundle = await fetch(url, {
      headers: { "X-Sync-Token": token },
      cache: "no-store",
    }).then((r) => (r.ok ? r.json() : null));
    const pnl = bundle?.pnl;
    if (!pnl) return null;
    const ven = new Map<string, number>();
    const chel = new Map<string, number>();
    for (const r of (pnl.venituri ?? []) as ClpRow[]) {
      const luna = r.data.slice(0, 7);
      ven.set(luna, (ven.get(luna) ?? 0) + r.suma);
    }
    for (const r of (pnl.cheltuieli ?? []) as ClpRow[]) {
      if ((r.categorie ?? "").trim().toLowerCase() === "dividende") continue; // profit distribuit, nu cost
      const luna = r.data.slice(0, 7);
      chel.set(luna, (chel.get(luna) ?? 0) + r.suma);
    }
    const luni = [...new Set([...ven.keys(), ...chel.keys()])].sort().slice(-4);
    return luni.map((luna) => ({
      luna,
      venituri: Math.round(ven.get(luna) ?? 0),
      cheltuieli: Math.round(chel.get(luna) ?? 0),
    }));
  } catch {
    return null;
  }
}

async function pnlPersonal() {
  const from = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 7);
  const [venit, chelt, wallet] = await Promise.all([
    db
      .select({
        luna: sql<string>`substring(${venituri.data}, 1, 7)`,
        total: sql<number>`round(sum(${venituri.suma})::numeric)`,
      })
      .from(venituri)
      .where(gte(venituri.data, from))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({
        luna: sql<string>`substring(${cheltuieli.data}, 1, 7)`,
        total: sql<number>`round(sum(${cheltuieli.suma})::numeric)`,
      })
      .from(cheltuieli)
      .where(gte(cheltuieli.data, from))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db.select().from(portofel).orderBy(desc(portofel.data)).limit(1),
  ]);
  return { venit, chelt, wallet: wallet[0] ?? null };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "unauth" }, { status: 401 });
  }

  const [og, pnl, clp] = await Promise.all([outglowStats(), pnlPersonal(), clpStats()]);
  const azi = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `*Sincronizat automat: ${azi} (cron săptămânal, luni dimineața; se poate rula și manual).*`,
    "",
    "## Outglow",
  ];

  if (og) {
    lines.push(
      `- **${og.users} useri** (${og.signups30d} în ultimele 30 zile) · **${og.paying} plătitori**`,
      `- ${og.projects} branduri · ${og.audits} audituri rulate`,
      `- Pragul de succes: $300 MRR până în ~ian 2027 — vezi pagina [Outglow]`,
    );
  } else {
    lines.push("- (env-urile Outglow lipsesc — sincronizare sărită)");
  }

  lines.push("", "## P&L personal (ultimele ~3 luni)");
  const cheltByLuna = new Map(pnl.chelt.map((c) => [c.luna, c.total]));
  for (const v of pnl.venit) {
    const c = cheltByLuna.get(v.luna) ?? 0;
    lines.push(`- ${v.luna}: venituri ${v.total} lei · cheltuieli ${c} lei · net ${v.total - c} lei`);
  }
  if (pnl.wallet) {
    const w = pnl.wallet;
    const total = Math.round(w.cash + w.ing + w.revolut + w.trading212);
    lines.push(`- Buffer portofel (${w.data}): **${total} lei** (cash ${w.cash} + ING ${w.ing} + Revolut ${w.revolut} + T212 ${w.trading212})`);
  }

  lines.push("", "## Cursuri la Pahar — P&L live (fără dividende)");
  if (clp?.length) {
    for (const m of clp) {
      lines.push(`- ${m.luna}: venituri ${m.venituri} lei · cheltuieli ${m.cheltuieli} lei · profit ${m.venituri - m.cheltuieli} lei`);
    }
    lines.push("- *Lunile recente pot fi parțiale — încasările LiveTickets vin în valuri.*");
  } else {
    lines.push("- (sync-export CLP indisponibil la această rulare)");
  }

  await upsertPage({
    slug: "stadiu-live",
    title: "Stadiu live",
    description: "Cifrele volatile ale proiectelor, sincronizate automat săptămânal.",
    contentMd: lines.join("\n"),
  });

  return Response.json({ ok: true, outglow: og, syncedAt: azi });
}

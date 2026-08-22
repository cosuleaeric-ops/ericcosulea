import Link from "next/link";
import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteTexts } from "@/lib/db/schema";
import { CHEI, GOALE, type NumeReguli, type Reguli } from "./reguli";
import { salveazaReguliAction } from "./actions";
import ReguliEditor from "./ReguliEditor";

export const metadata: Metadata = {
  title: "reguli blog",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function citesteReguli(): Promise<Reguli> {
  const randuri = await db
    .select()
    .from(siteTexts)
    .where(inArray(siteTexts.textKey, Object.values(CHEI)));

  const dupaCheie = new Map(randuri.map((r) => [r.textKey, r.textValue]));
  const reguli = { ...GOALE };
  for (const [nume, cheie] of Object.entries(CHEI) as [NumeReguli, string][]) {
    reguli[nume] = dupaCheie.get(cheie) ?? "";
  }
  return reguli;
}

export default async function ReguliBlogPage() {
  const reguli = await citesteReguli();

  return (
    <main className="mx-auto max-w-[700px] px-9 py-8">
      <Link className="text-sm text-muted-foreground hover:text-foreground" href="/admin">
        ← admin
      </Link>
      <h1 className="mt-3 text-xl font-semibold">reguli blog</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">
        regulile după care se scriu articolele
      </p>
      <ReguliEditor initial={reguli} saveAction={salveazaReguliAction} />
    </main>
  );
}

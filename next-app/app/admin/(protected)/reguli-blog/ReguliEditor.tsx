"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SECUNDARE, type NumeReguli, type Reguli } from "./reguli";
import type { StareSalvare } from "./actions";
import EditorBogat from "./EditorBogat";

type Props = {
  initial: Reguli;
  saveAction: (prev: StareSalvare, formData: FormData) => Promise<StareSalvare>;
};

function ButonSalvare({ nemodificat }: { nemodificat: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || nemodificat}>
      {pending ? "..." : "salvează"}
    </Button>
  );
}

// Cât scrie înăuntru, numărat în cuvinte, pe text, nu pe HTML.
// Româna cere „de” când ultimele două cifre ies din 1-19: 19 cuvinte, 20 de cuvinte.
function cat(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text === "") return "gol";
  const n = text.split(" ").length;
  if (n === 1) return "1 cuvânt";
  const rest = n % 100;
  const de = rest >= 1 && rest <= 19 ? "" : "de ";
  return `${n.toLocaleString("ro-RO")} ${de}cuvinte`;
}

export default function ReguliEditor({ initial, saveAction }: Props) {
  const [state, formAction] = useActionState(saveAction, undefined);
  const [valori, setValori] = useState<Reguli>(initial);

  const scrie = (nume: NumeReguli, html: string) =>
    setValori((v) => (v[nume] === html ? v : { ...v, [nume]: html }));

  const nemodificat = (Object.keys(initial) as NumeReguli[]).every(
    (k) => valori[k] === initial[k],
  );

  return (
    <form action={formAction} className="mt-5">
      {(Object.keys(valori) as NumeReguli[]).map((nume) => (
        <input key={nume} type="hidden" name={nume} value={valori[nume]} />
      ))}

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <Label>reguli blog</Label>
          <span className="text-[11px] text-muted-foreground">{cat(valori.blog)}</span>
        </div>
        <EditorBogat
          valoare={initial.blog}
          onChange={(html) => scrie("blog", html)}
          minHeight={460}
        />
      </div>

      <div className="mt-4 divide-y divide-border rounded-md border border-border">
        {SECUNDARE.map(({ nume, eticheta }) => (
          <details key={nume} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-90" />
              <span className="font-medium">{eticheta}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{cat(valori[nume])}</span>
            </summary>
            <div className="px-3 pb-3">
              <EditorBogat
                valoare={initial[nume]}
                onChange={(html) => scrie(nume, html)}
                minHeight={200}
              />
            </div>
          </details>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <ButonSalvare nemodificat={nemodificat} />
        {state?.error ? (
          <span className="text-xs text-destructive">{state.error}</span>
        ) : !nemodificat ? (
          <span className="text-xs text-muted-foreground">modificări nesalvate</span>
        ) : state?.salvatLa ? (
          <span className="text-xs text-muted-foreground">salvat</span>
        ) : null}
      </div>
    </form>
  );
}

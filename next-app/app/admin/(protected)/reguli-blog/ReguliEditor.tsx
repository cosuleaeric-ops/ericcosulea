"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SECUNDARE, type NumeReguli, type Reguli } from "./reguli";
import type { StareSalvare } from "./actions";

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

// Cât scrie înăuntru, ca să se vadă fără să deschizi secțiunea.
function cat(text: string): string {
  const n = text.trim().length;
  return n === 0 ? "gol" : `${n} caractere`;
}

export default function ReguliEditor({ initial, saveAction }: Props) {
  const [state, formAction] = useActionState(saveAction, undefined);
  const [valori, setValori] = useState<Reguli>(initial);

  const scrie = (nume: NumeReguli, text: string) =>
    setValori((v) => ({ ...v, [nume]: text }));

  const nemodificat = (Object.keys(initial) as NumeReguli[]).every(
    (k) => valori[k] === initial[k],
  );

  return (
    <form action={formAction} className="mt-6">
      <div>
        <Label htmlFor="blog" className="mb-2">
          reguli blog
        </Label>
        <Textarea
          id="blog"
          name="blog"
          value={valori.blog}
          onChange={(e) => scrie("blog", e.target.value)}
          className="min-h-[320px] leading-relaxed"
          placeholder="Încă goale."
        />
      </div>

      <div className="mt-5 divide-y divide-border rounded-md border border-border">
        {SECUNDARE.map(({ nume, eticheta }) => (
          <details key={nume} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm hover:bg-secondary">
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-90" />
              <span className="font-medium">{eticheta}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {cat(valori[nume])}
              </span>
            </summary>
            <div className="px-4 pb-4">
              <Textarea
                id={nume}
                name={nume}
                value={valori[nume]}
                onChange={(e) => scrie(nume, e.target.value)}
                className="min-h-[180px] leading-relaxed"
                placeholder="Încă goale."
              />
            </div>
          </details>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
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

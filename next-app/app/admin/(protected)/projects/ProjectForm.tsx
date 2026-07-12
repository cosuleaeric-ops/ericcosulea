"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionState = { error?: string } | undefined;

type Props = {
  initial?: {
    id: number;
    name: string;
    description: string | null;
    url: string;
    logo: string;
    sort: number;
  };
  saveAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "..." : "salvează"}
    </Button>
  );
}

export default function ProjectForm({ initial, saveAction }: Props) {
  const [state, formAction] = useActionState(saveAction, undefined);

  return (
    <form className="mt-6 flex flex-col gap-4" action={formAction}>
      {initial?.id != null && <input type="hidden" name="id" value={initial.id} />}
      {initial?.logo && <input type="hidden" name="existing_logo" value={initial.logo} />}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="grid gap-2">
        <Label htmlFor="name">Nume</Label>
        <Input type="text" id="name" name="name" defaultValue={initial?.name ?? ""} required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Descriere (opțional)</Label>
        <Input type="text" id="description" name="description" defaultValue={initial?.description ?? ""} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="url">URL</Label>
        <Input type="url" id="url" name="url" defaultValue={initial?.url ?? ""} required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sort">Ordine sortare</Label>
        <Input type="number" id="sort" name="sort" defaultValue={initial?.sort ?? 99} required />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="logo_file">Logo</Label>
        {initial?.logo && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={initial.logo} alt="" className="size-8 rounded-lg object-contain" />
            <span className="text-sm text-muted-foreground">{initial.logo}</span>
          </div>
        )}
        <Input type="file" id="logo_file" name="logo_file" accept="image/*" />
        {!initial?.logo && (
          <p className="text-sm text-muted-foreground">Acceptă jpg, png, webp, gif, svg.</p>
        )}
      </div>

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}

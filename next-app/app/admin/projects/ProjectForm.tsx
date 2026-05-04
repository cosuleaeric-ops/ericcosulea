"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

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
    <button type="submit" className="btn" disabled={pending}>
      {pending ? "..." : "salvează"}
    </button>
  );
}

export default function ProjectForm({ initial, saveAction }: Props) {
  const [state, formAction] = useActionState(saveAction, undefined);

  return (
    <form className="post-editor" action={formAction}>
      {initial?.id != null && <input type="hidden" name="id" value={initial.id} />}
      {initial?.logo && <input type="hidden" name="existing_logo" value={initial.logo} />}

      {state?.error && <p className="login-error">{state.error}</p>}

      <label className="form-label" htmlFor="name">Nume</label>
      <input className="form-input" type="text" id="name" name="name" defaultValue={initial?.name ?? ""} required />

      <label className="form-label" htmlFor="description">Descriere (opțional)</label>
      <input className="form-input" type="text" id="description" name="description" defaultValue={initial?.description ?? ""} />

      <label className="form-label" htmlFor="url">URL</label>
      <input className="form-input" type="url" id="url" name="url" defaultValue={initial?.url ?? ""} required />

      <label className="form-label" htmlFor="sort">Ordine sortare</label>
      <input className="form-input" type="number" id="sort" name="sort" defaultValue={initial?.sort ?? 99} required />

      <label className="form-label">Logo</label>
      {initial?.logo && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={initial.logo} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 8 }} />
          <span className="post-item-date">{initial.logo}</span>
        </div>
      )}
      <input className="form-input" type="file" id="logo_file" name="logo_file" accept="image/*" />
      {!initial?.logo && <p className="post-item-date">Acceptă jpg, png, webp, gif, svg.</p>}

      <div className="form-actions">
        <SubmitButton />
      </div>
    </form>
  );
}

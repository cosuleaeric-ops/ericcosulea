"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial?: {
    id: number;
    name: string;
    description: string | null;
    url: string;
    logo: string;
    sort: number;
  };
  saveAction: (formData: FormData) => Promise<{ error?: string; redirectTo?: string }>;
};

export default function ProjectForm({ initial, saveAction }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (initial?.id != null) {
      fd.set("id", String(initial.id));
      fd.set("existing_logo", initial.logo);
    }
    setError(null);
    startTransition(async () => {
      const result = await saveAction(fd);
      if (result?.error) setError(result.error);
      else if (result?.redirectTo) router.push(result.redirectTo);
    });
  };

  return (
    <form className="post-editor" onSubmit={onSubmit}>
      {error && <p className="login-error">{error}</p>}

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
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "..." : "salvează"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
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
  const [pending, setPending] = useState(false);

  const handleAction = async (formData: FormData) => {
    setError(null);
    setPending(true);
    try {
      const result = await saveAction(formData);
      if (result?.error) setError(result.error);
      else if (result?.redirectTo) router.push(result.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="post-editor" action={handleAction}>
      {initial?.id != null && <input type="hidden" name="id" value={initial.id} />}
      {initial?.logo && <input type="hidden" name="existing_logo" value={initial.logo} />}

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

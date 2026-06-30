"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export function AddWebsite() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!domain.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, name }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Eroare");
        return;
      }
      setOpen(false);
      router.push(`/elitedata/${j.publicId}/settings`);
    } catch {
      setError("Eroare de rețea");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="dfa-btn dfa-btn-primary" onClick={() => setOpen(true)}>
        <Plus size={15} /> Website
      </button>

      {open && (
        <div
          className="dfa-modal-backdrop dfa-anim-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="dfa-modal dfa-anim-in"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
              <div className="dfa-modal-head">
                <h3>Add website</h3>
                <button className="dfa-btn dfa-btn-icon" onClick={() => setOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              <div className="dfa-addsite">
                <label>
                  Domain
                  <input
                    autoFocus
                    placeholder="exemplu.ro"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </label>
                <label>
                  Name (optional)
                  <input
                    placeholder="Numele site-ului"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                  />
                </label>
                {error && <div className="dfa-banner dfa-banner-warn">{error}</div>}
                <div className="dfa-custom-actions">
                  <button className="dfa-btn" onClick={() => setOpen(false)}>Cancel</button>
                  <button className="dfa-btn dfa-btn-primary" onClick={submit} disabled={busy}>
                    {busy ? "Adding…" : "Add website"}
                  </button>
                </div>
              </div>
          </div>
        </div>
      )}
    </>
  );
}

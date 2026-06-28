"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, CheckCircle2, AlertTriangle } from "lucide-react";

type SitesResp = {
  connected: boolean;
  email: string | null;
  selected: string | null;
  properties: { siteUrl: string; permissionLevel: string }[];
};

export function GscIntegration({ sitePublicId }: { sitePublicId: string }) {
  const params = useSearchParams();
  const banner = params.get("gsc");
  const [data, setData] = useState<SitesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/gsc/sites?site=${sitePublicId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const j: SitesResp = await res.json();
        setData(j);
        setSelected(j.selected ?? j.properties[0]?.siteUrl ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitePublicId]);

  async function saveProperty() {
    setSaving(true);
    try {
      await fetch("/api/analytics/gsc/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: sitePublicId, siteUrl: selected }),
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    await fetch("/api/analytics/gsc/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: sitePublicId }),
    });
    await refresh();
  }

  return (
    <section className="dfa-card dfa-settings-card">
      <h2>Google Search Console</h2>

      {banner === "not_configured" && (
        <div className="dfa-banner dfa-banner-warn">
          <AlertTriangle size={15} /> Env vars Google lipsesc (GOOGLE_CLIENT_ID /
          SECRET / REDIRECT_URI). Adaugă-le în Vercel ca să funcționeze.
        </div>
      )}
      {banner === "connected" && (
        <div className="dfa-banner dfa-banner-ok">
          <CheckCircle2 size={15} /> Conectat la Google Search Console.
        </div>
      )}
      {(banner === "error" || banner === "csrf") && (
        <div className="dfa-banner dfa-banner-warn">
          <AlertTriangle size={15} /> Conectarea a eșuat. Încearcă din nou.
        </div>
      )}

      {loading ? (
        <div className="dfa-skeleton" style={{ height: 40 }} />
      ) : data?.connected ? (
        <div className="dfa-gsc-connected">
          <div className="dfa-gsc-email">
            <CheckCircle2 size={16} className="dfa-gsc-ok-ico" />
            <span>{data.email ?? "Connected"}</span>
          </div>
          <label className="dfa-gsc-prop">
            Proprietate
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              {data.properties.length === 0 && <option value="">(nicio proprietate)</option>}
              {data.properties.map((p) => (
                <option key={p.siteUrl} value={p.siteUrl}>
                  {p.siteUrl}
                </option>
              ))}
            </select>
          </label>
          <div className="dfa-gsc-actions">
            <button className="dfa-btn dfa-btn-primary" onClick={saveProperty} disabled={saving || !selected}>
              {saving ? "Saving…" : "Save property"}
            </button>
            <button className="dfa-btn" onClick={disconnect}>Disconnect</button>
          </div>
        </div>
      ) : (
        <>
          <p className="dfa-muted">
            Vezi ce keywords îți aduc trafic din Google. Site-ul trebuie verificat
            în Search Console, iar tu ai nevoie de permisiuni de owner sau full user.
          </p>
          <a className="dfa-btn dfa-btn-primary" href={`/api/analytics/gsc/connect?site=${sitePublicId}`}>
            <Search size={15} /> Connect Google Search Console
          </a>
        </>
      )}

      <p className="dfa-gsc-note">
        Datele GSC pot apărea cu 24–48h întârziere.
      </p>
    </section>
  );
}

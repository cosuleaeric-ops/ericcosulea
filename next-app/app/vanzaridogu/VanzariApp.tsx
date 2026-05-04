"use client";

import { useState } from "react";
import { parseBreezeXls, buildBreakdown, formatRon, type RestaurantBreakdown } from "./parser";

const RESTAURANTS: Array<{ key: keyof Omit<RestaurantBreakdown, "byCategory" | "total" | "ambalaj">; label: string; icon: string; bg: string; accent: string }> = [
  { key: "dogu", label: "DOGU", icon: "🍔", bg: "#FFF3E0", accent: "#E65100" },
  { key: "turmerizza", label: "Turmerizza", icon: "🍕", bg: "#FFF8E1", accent: "#F57F17" },
  { key: "gustoria", label: "Gustoria", icon: "🥗", bg: "#E8F5E9", accent: "#2E7D32" },
  { key: "hotdog", label: "HotDog de Bucuresti", icon: "🌭", bg: "#FCE4EC", accent: "#C62828" },
];

export default function VanzariApp() {
  const [filename, setFilename] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<RestaurantBreakdown | null>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xls" && ext !== "xml") {
      setError("Format nesuportat. Încarcă un export Breeze (.xls).");
      return;
    }
    setError(null);
    setFilename(file.name);
    try {
      const text = await file.text();
      const report = parseBreezeXls(text);
      setBreakdown(buildBreakdown(report));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare necunoscută.");
      setBreakdown(null);
    }
  };

  return (
    <div className="vanzari-wrap">
      <div className="vanzari-card">
        <h2 className="vanzari-card-title">Încarcă raport Breeze</h2>
        <p className="vanzari-card-sub">Exportul de vânzări din Breeze (.xls). Se analizează automat secțiunea <strong>Restaurant</strong>.</p>

        <label className="vanzari-file-drop">
          <input type="file" accept=".xls,.xml" onChange={onFileChange} />
          <span className="vanzari-file-icon">📊</span>
          <span className="vanzari-file-text">Click pentru selectare</span>
        </label>

        {error && <div className="vanzari-alert">{error}</div>}
      </div>

      {breakdown && (
        <>
          <div className="vanzari-report-header">
            <div>
              <span className="vanzari-badge">🍽️ Restaurant</span>
              <h2 className="vanzari-report-title">Raport vânzări</h2>
              <p className="vanzari-report-filename">📄 {filename}</p>
            </div>
            <div className="vanzari-total-block">
              <div className="vanzari-total-label">Total încasat Restaurant</div>
              <div className="vanzari-total-value">{formatRon(breakdown.total)}</div>
            </div>
          </div>

          <div className="vanzari-section-title">Defalcat pe restaurante</div>
          <div className="vanzari-rest-grid">
            {RESTAURANTS.map((r) => (
              <div key={r.key} className="vanzari-rest-card" style={{ background: r.bg }}>
                <div className="vanzari-rest-icon">{r.icon}</div>
                <div className="vanzari-rest-label">{r.label}</div>
                <div className="vanzari-rest-amount" style={{ color: r.accent }}>{formatRon(breakdown[r.key])}</div>
                <div className="vanzari-rest-count">{breakdown.byCategory[r.key].length} produse</div>
              </div>
            ))}
          </div>

          <div className="vanzari-section-title">Ambalaj total: <strong>{formatRon(breakdown.ambalaj)}</strong></div>
        </>
      )}
    </div>
  );
}

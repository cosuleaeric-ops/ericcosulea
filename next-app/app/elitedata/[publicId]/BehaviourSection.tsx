"use client";
import { useEffect, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/analytics/format";
import type { BehaviourStats } from "@/lib/analytics/queries";

// Cât din pagină citește omul și pe ce apasă. Datele vin din evenimentele
// "scroll" și "click" ale scriptului nostru, deci acoperă toate site-urile,
// nu doar pe cele cu tracking de comportament de la terți.

function BarList({
  rows,
  suffix,
}: {
  rows: { key: string; value: number; pct?: number }[];
  suffix?: (row: { value: number; pct?: number }) => string;
}) {
  const max = rows.length ? Math.max(...rows.map((r) => r.value)) : 0;
  return (
    <div className="dfa-crawler-list">
      {rows.slice(0, 8).map((row) => {
        const width = max ? (row.value / max) * 100 : 0;
        return (
          <div key={row.key} className="dfa-row" title={row.key}>
            <motion.span
              className="dfa-row-bar"
              initial={{ width: 0 }}
              animate={{ width: `${width}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
            <span className="dfa-row-main">
              <span className="dfa-row-label">{row.key}</span>
            </span>
            <span className="dfa-row-value">
              {suffix ? suffix(row) : formatNumber(row.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function BehaviourSection({
  site,
  from,
  to,
}: {
  site: string;
  from: string;
  to: string;
}) {
  const [data, setData] = useState<BehaviourStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ site, from, to });
    fetch(`/api/analytics/behaviour?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: BehaviourStats | null) => {
        if (cancelled) return;
        setData(j);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [site, from, to]);

  const gol =
    !loading && (!data || (data.scrollReach.length === 0 && data.clicks.length === 0));

  return (
    <div className="dfa-card dfa-crawler-card">
      <div className="dfa-crawler-head">
        <div className="dfa-crawler-title">
          <MousePointerClick size={16} />
          <span>Comportament în pagină</span>
        </div>
        {data && data.totalClicks > 0 && (
          <div className="dfa-crawler-stats">
            <span>
              <strong>{formatNumber(data.totalClicks)}</strong> click-uri
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="dfa-panel-skel" style={{ padding: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="dfa-skeleton" style={{ height: 18, width: `${88 - i * 9}%` }} />
          ))}
        </div>
      ) : gol ? (
        <div className="dfa-panel-empty">
          Niciun scroll și niciun click în perioada asta. Se colectează de la sine,
          din scriptul de pe site — nu trebuie marcat nimic în cod.
        </div>
      ) : (
        <>
          {data!.scrollReach.length > 0 && (
            <div className="dfa-crawler-cats">
              {data!.scrollReach.map((r) => (
                <span key={r.key} className="dfa-crawler-cat">
                  {r.key}% din pagină
                  <strong>{Math.round(r.pct)}%</strong>
                </span>
              ))}
            </div>
          )}
          <div className="dfa-crawler-cols">
            <div>
              <div className="dfa-crawler-col-title">Pe ce se apasă</div>
              <BarList rows={data!.clicks} />
            </div>
            <div>
              <div className="dfa-crawler-col-title">Citit până la capăt</div>
              <BarList
                rows={data!.scrollByPath}
                suffix={(r) => `${Math.round(r.pct ?? 0)}%`}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

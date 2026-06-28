"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { formatNumber } from "@/lib/analytics/format";
import { KeywordModal } from "./KeywordModal";

export type KeywordRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type Result =
  | { connected: false }
  | { connected: true; needsProperty: true }
  | { connected: true; needsProperty?: false; rows: KeywordRow[] };

const ROWS_SHOWN = 7;

export function KeywordTab({
  site,
  from,
  to,
  path,
}: {
  site: string;
  from: string;
  to: string;
  path?: string;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const p = new URLSearchParams({ site, from, to });
    if (path) p.set("path", path);
    fetch(`/api/analytics/gsc/keywords?${p}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { connected: false }))
      .then((j) => !cancelled && setResult(j))
      .catch(() => !cancelled && setResult({ connected: false }))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [site, from, to, path]);

  if (loading) {
    return (
      <div className="dfa-panel-skel">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="dfa-skeleton" style={{ height: 18, width: `${88 - i * 8}%` }} />
        ))}
      </div>
    );
  }

  if (!result || !result.connected) {
    return (
      <div className="dfa-connect-note">
        <Search size={20} className="dfa-faint" />
        <p>Conectează Google Search Console ca să vezi keywords.</p>
        <a className="dfa-btn dfa-btn-primary" href={`/elitedata/${site}/settings`}>
          Connect
        </a>
      </div>
    );
  }

  if ("needsProperty" in result && result.needsProperty) {
    return (
      <div className="dfa-connect-note">
        <Search size={20} className="dfa-faint" />
        <p>Alege proprietatea GSC în Settings.</p>
        <a className="dfa-btn" href={`/elitedata/${site}/settings`}>
          Settings
        </a>
      </div>
    );
  }

  const rows = result.rows ?? [];
  if (rows.length === 0) {
    return <div className="dfa-panel-empty">Niciun keyword în perioada asta {path ? `pe ${path}` : ""}.</div>;
  }

  const max = rows[0]?.clicks || 1;
  const shown = rows.slice(0, ROWS_SHOWN);

  return (
    <>
      {shown.map((r) => {
        const pct = (r.clicks / max) * 100;
        return (
          <div key={r.query} className="dfa-row">
            <motion.span
              className="dfa-row-bar"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />
            <span className="dfa-row-main">
              <span className="dfa-row-label">{r.query}</span>
            </span>
            <span className="dfa-row-value">{formatNumber(r.clicks)}</span>
          </div>
        );
      })}
      <button className="dfa-panel-details dfa-keyword-details" onClick={() => setModal(true)}>
        DETAILS
      </button>
      {modal && <KeywordModal rows={rows} path={path} onClose={() => setModal(false)} />}
    </>
  );
}

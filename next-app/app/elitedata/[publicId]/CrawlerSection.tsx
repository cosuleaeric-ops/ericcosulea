"use client";
import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { motion } from "framer-motion";
import { formatNumber } from "@/lib/analytics/format";
import type { CrawlerStats } from "@/lib/analytics/queries";

const CATEGORY_LABEL: Record<string, string> = {
  answer: "AI answers",
  search: "AI search",
  training: "Training",
  other: "Alte",
};
const CATEGORY_COLOR: Record<string, string> = {
  answer: "#10b981",
  search: "#6366f1",
  training: "#f59e0b",
  other: "#94a3b8",
};

function catColor(cat: string): string {
  return CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.other;
}

function BarList({
  rows,
  color,
}: {
  rows: { key: string; value: number; category?: string }[];
  color?: (row: { key: string; category?: string }) => string;
}) {
  const max = rows.length ? rows[0].value : 0;
  return (
    <div className="dfa-crawler-list">
      {rows.slice(0, 8).map((row) => {
        const pct = max ? (row.value / max) * 100 : 0;
        const c = color?.(row);
        return (
          <div key={row.key} className="dfa-row" title={row.key}>
            <motion.span
              className="dfa-row-bar"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              style={c ? { background: `color-mix(in srgb, ${c} 22%, transparent)` } : undefined}
            />
            <span className="dfa-row-main">
              {c && (
                <span className="dfa-row-ico">
                  <span className="dfa-crawler-dot" style={{ background: c }} />
                </span>
              )}
              <span className="dfa-row-label">{row.key}</span>
            </span>
            <span className="dfa-row-value">{formatNumber(row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CrawlerSection({
  site,
  from,
  to,
}: {
  site: string;
  from: string;
  to: string;
}) {
  const [data, setData] = useState<CrawlerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ site, from, to });
    fetch(`/api/analytics/crawlers?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: CrawlerStats | null) => {
        if (cancelled) return;
        setData(j);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [site, from, to]);

  const empty = !loading && (!data || data.total === 0);

  return (
    <div className="dfa-card dfa-crawler-card">
      <div className="dfa-crawler-head">
        <div className="dfa-crawler-title">
          <Bot size={16} />
          <span>Crawlere AI</span>
        </div>
        {data && data.total > 0 && (
          <div className="dfa-crawler-stats">
            <span>
              <strong>{formatNumber(data.total)}</strong> vizite
            </span>
            <span>
              <strong>{data.uniqueCrawlers}</strong> crawlere
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
      ) : empty ? (
        <div className="dfa-panel-empty">
          Niciun crawler AI în perioada asta. GPTBot, ClaudeBot, PerplexityBot & co. nu
          rulează JavaScript — sunt prinse server-side (vezi snippetul din Settings).
        </div>
      ) : (
        <>
          {data!.byCategory.length > 0 && (
            <div className="dfa-crawler-cats">
              {data!.byCategory.map((c) => (
                <span key={c.key} className="dfa-crawler-cat">
                  <span className="dfa-crawler-dot" style={{ background: catColor(c.key) }} />
                  {CATEGORY_LABEL[c.key] ?? c.key}
                  <strong>{formatNumber(c.value)}</strong>
                </span>
              ))}
            </div>
          )}
          <div className="dfa-crawler-cols">
            <div>
              <div className="dfa-crawler-col-title">Crawler</div>
              <BarList rows={data!.byCrawler} color={(r) => catColor(r.category ?? "other")} />
            </div>
            <div>
              <div className="dfa-crawler-col-title">Pagini accesate</div>
              <BarList rows={data!.byPath} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronDown } from "lucide-react";
import { computeRange, type PeriodKey } from "@/lib/analytics/range";
import { formatNumber } from "@/lib/analytics/format";
import { Sparkline } from "./_components/Sparkline";
import { Dropdown } from "./_components/Dropdown";
import { AddWebsite } from "./AddWebsite";

type SortKey = "views" | "alpha";
const SORT_OPTS: { key: SortKey; label: string }[] = [
  { key: "views", label: "Most visitors" },
  { key: "alpha", label: "A → Z" },
];
const SORT_LABELS: Record<SortKey, string> = {
  views: "Most visitors",
  alpha: "A → Z",
};

type Site = {
  publicId: string;
  domain: string;
  faviconUrl: string | null;
  visitors: number;
  spark: number[];
};
type Data = { totalVisitors: number; sites: Site[] };

const OPTS: { key: PeriodKey; label: string }[] = [
  { key: "last24h", label: "last 24 hours" },
  { key: "last7", label: "last 7 days" },
  { key: "last30", label: "last 30 days" },
];
const LABELS: Record<string, string> = Object.fromEntries(
  OPTS.map((o) => [o.key, o.label]),
);

export function OverviewClient({
  ownerName,
  initial,
}: {
  ownerName: string;
  initial: Data;
}) {
  const [period, setPeriod] = useState<PeriodKey>("last7");
  const [data, setData] = useState<Data>(initial);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>("views");
  const first = useRef(true);

  const sortedSites = useMemo(() => {
    const arr = [...data.sites];
    if (sort === "alpha") arr.sort((a, b) => a.domain.localeCompare(b.domain));
    else arr.sort((a, b) => b.visitors - a.visitors);
    return arr;
  }, [data.sites, sort]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // randarea inițială folosește datele de la server
    }
    const r = computeRange(period);
    const granularity = period === "last24h" ? "hourly" : "daily";
    const params = new URLSearchParams({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      granularity,
    });
    setLoading(true);
    fetch(`/api/analytics/overview?${params}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => j && setData(j))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <>
      <div className="dfa-overview-head">
        <h1 className="dfa-headline">
          Hey {ownerName}, you got{" "}
          <strong>{formatNumber(data.totalVisitors)} visitors</strong> in the{" "}
          <Dropdown
            align="left"
            width={170}
            value={period}
            onSelect={(k) => setPeriod(k as PeriodKey)}
            trigger={<span className="dfa-pill-period">{LABELS[period]}</span>}
            items={OPTS.map((o) => ({ key: o.key, label: o.label }))}
          />
        </h1>
        <div className="dfa-overview-actions">
          {data.sites.length > 1 && (
            <Dropdown
              align="right"
              width={170}
              value={sort}
              onSelect={(k) => setSort(k as SortKey)}
              trigger={
                <span className="dfa-period-trigger">
                  <ArrowDownUp size={14} className="dfa-faint" />
                  {SORT_LABELS[sort]}
                  <ChevronDown size={14} className="dfa-faint" />
                </span>
              }
              items={SORT_OPTS.map((o) => ({ key: o.key, label: o.label }))}
            />
          )}
          <AddWebsite />
        </div>
      </div>

      {data.sites.length === 0 ? (
        <div className="dfa-empty">
          <h3>No websites yet</h3>
          <p>Adaugă primul site ca să primești pageview-uri.</p>
        </div>
      ) : (
        <div
          className="dfa-site-grid"
          style={{ opacity: loading ? 0.5 : 1, transition: "opacity 150ms ease" }}
        >
          {sortedSites.map((s, i) => (
            <Link
              key={s.publicId}
              href={`/elitedata/${s.publicId}`}
              className="dfa-card dfa-site-card"
            >
              <div className="dfa-site-card-head">
                {s.faviconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.faviconUrl} alt="" width={18} height={18} className="dfa-favicon-img" />
                ) : (
                  <span className="dfa-favicon">{s.domain.charAt(0).toUpperCase()}</span>
                )}
                {s.domain}
              </div>
              {/* key include perioada -> re-animă draw-in la refresh / schimbare perioadă */}
              <Sparkline key={`${period}-${s.publicId}`} data={s.spark} delay={i * 0.07} />
              <div className="dfa-site-card-foot">
                <strong>{formatNumber(s.visitors)}</strong> visitors
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

"use client";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  SlidersHorizontal,
  RefreshCw,
  GitCompare,
} from "lucide-react";
import { Dropdown } from "../_components/Dropdown";
import {
  PERIOD_LABELS,
  PERIOD_ORDER,
  type Granularity,
  type PeriodKey,
} from "@/lib/analytics/range";

type SiteLite = { publicId: string; domain: string; faviconUrl: string | null };

export function ControlBar({
  site,
  sites,
  period,
  offset,
  rangeLabel,
  granularity,
  compare,
  refreshing,
  filterCount,
  onPeriod,
  onShift,
  onGranularity,
  onToggleCompare,
  onRefresh,
  onFilter,
}: {
  site: SiteLite;
  sites: SiteLite[];
  period: PeriodKey;
  offset: number;
  rangeLabel: string;
  granularity: Granularity;
  compare: boolean;
  refreshing: boolean;
  filterCount: number;
  onPeriod: (p: PeriodKey) => void;
  onShift: (dir: -1 | 1) => void;
  onGranularity: (g: Granularity) => void;
  onToggleCompare: () => void;
  onRefresh: () => void;
  onFilter: () => void;
}) {
  const router = useRouter();

  return (
    <div className="dfa-controlbar">
      <div className="dfa-controlbar-left">
        <Dropdown
          align="left"
          width={220}
          value={site.publicId}
          onSelect={(key) => key !== site.publicId && router.push(`/analytics/${key}`)}
          trigger={
            <span className="dfa-site-trigger">
              <Favicon site={site} />
              {site.domain}
              <ChevronDown size={15} className="dfa-faint" />
            </span>
          }
          items={sites.map((s) => ({
            key: s.publicId,
            label: s.domain,
            icon: <Favicon site={s} />,
          }))}
        />
        <a className="dfa-btn dfa-btn-icon" href={`/analytics/${site.publicId}/settings`} title="Settings">
          <Settings size={16} />
        </a>
      </div>

      <div className="dfa-controlbar-right">
        <div className="dfa-period-nav">
          <button className="dfa-btn dfa-btn-icon" onClick={() => onShift(-1)} title="Previous">
            <ChevronLeft size={16} />
          </button>
          <Dropdown
            align="left"
            width={180}
            value={period}
            onSelect={(k) => onPeriod(k as PeriodKey)}
            trigger={
              <span className="dfa-period-trigger">
                {offset === 0 ? PERIOD_LABELS[period] : rangeLabel}
                <ChevronDown size={15} className="dfa-faint" />
              </span>
            }
            items={PERIOD_ORDER.map((k) => ({ key: k, label: PERIOD_LABELS[k] }))}
          />
          <button
            className="dfa-btn dfa-btn-icon"
            onClick={() => onShift(1)}
            disabled={offset >= 0}
            title="Next"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <button
          className={`dfa-btn${compare ? " is-active" : ""}`}
          onClick={onToggleCompare}
          title="Compare cu perioada anterioară"
        >
          <GitCompare size={15} /> Compare
        </button>

        <Dropdown
          align="right"
          width={140}
          value={granularity}
          onSelect={(k) => onGranularity(k as Granularity)}
          trigger={
            <span className="dfa-period-trigger">
              {granularity === "hourly" ? "Hourly" : "Daily"}
              <ChevronDown size={15} className="dfa-faint" />
            </span>
          }
          items={[
            { key: "hourly", label: "Hourly" },
            { key: "daily", label: "Daily" },
          ]}
        />

        <button
          className={`dfa-btn dfa-btn-icon${filterCount ? " is-active" : ""}`}
          onClick={onFilter}
          title="Filtre"
        >
          <SlidersHorizontal size={16} />
          {filterCount > 0 && <span className="dfa-filter-badge">{filterCount}</span>}
        </button>

        <button
          className="dfa-btn dfa-btn-icon"
          onClick={onRefresh}
          title="Refresh"
        >
          <RefreshCw size={16} className={refreshing ? "dfa-spin" : ""} />
        </button>
      </div>
    </div>
  );
}

function Favicon({ site }: { site: SiteLite }) {
  if (site.faviconUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={site.faviconUrl} alt="" className="dfa-favicon-img" width={18} height={18} />;
  }
  return <span className="dfa-favicon">{site.domain.charAt(0).toUpperCase()}</span>;
}

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
import { PeriodPicker } from "./PeriodPicker";
import {
  isNavigable,
  type Granularity,
  type PeriodKey,
} from "@/lib/analytics/range";

type SiteLite = { publicId: string; domain: string; faviconUrl: string | null };

const GRANULARITY_LABELS: Record<Granularity, string> = {
  minute: "Per minute",
  hourly: "Hourly",
  daily: "Daily",
  monthly: "Monthly",
};

export function ControlBar({
  site,
  sites,
  period,
  offset,
  displayLabel,
  tz,
  custom,
  granularity,
  compare,
  refreshing,
  filterCount,
  onPeriod,
  onCustom,
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
  displayLabel: string;
  tz: string;
  custom: { from: string; to: string } | null;
  granularity: Granularity;
  compare: boolean;
  refreshing: boolean;
  filterCount: number;
  onPeriod: (p: PeriodKey) => void;
  onCustom: (from: string, to: string) => void;
  onShift: (dir: -1 | 1) => void;
  onGranularity: (g: Granularity) => void;
  onToggleCompare: () => void;
  onRefresh: () => void;
  onFilter: () => void;
}) {
  const router = useRouter();
  const navigable = isNavigable(period);

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
          <button
            className="dfa-btn dfa-btn-icon"
            onClick={() => onShift(-1)}
            disabled={!navigable}
            title="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <PeriodPicker
            period={period}
            displayLabel={displayLabel}
            tz={tz}
            custom={custom}
            onSelect={onPeriod}
            onCustom={onCustom}
          />
          <button
            className="dfa-btn dfa-btn-icon"
            onClick={() => onShift(1)}
            disabled={!navigable || offset >= 0}
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
          width={150}
          value={granularity}
          onSelect={(k) => onGranularity(k as Granularity)}
          trigger={
            <span className="dfa-period-trigger">
              {GRANULARITY_LABELS[granularity]}
              <ChevronDown size={15} className="dfa-faint" />
            </span>
          }
          items={(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => ({
            key: g,
            label: GRANULARITY_LABELS[g],
          }))}
        />

        <button
          className={`dfa-btn dfa-btn-icon${filterCount ? " is-active" : ""}`}
          onClick={onFilter}
          title="Filtre"
        >
          <SlidersHorizontal size={16} />
          {filterCount > 0 && <span className="dfa-filter-badge">{filterCount}</span>}
        </button>

        <button className="dfa-btn dfa-btn-icon" onClick={onRefresh} title="Refresh">
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

"use client";
import { useState, type ReactNode } from "react";
import { Monitor, Smartphone, Tablet, Globe, Map as MapIcon } from "lucide-react";
import { BreakdownPanel, type TabDef } from "./BreakdownPanel";
import { BreakdownModal } from "./BreakdownModal";
import { KeywordTab } from "./KeywordTab";
import type { Breakdowns, BreakdownRow, Filters } from "@/lib/analytics/queries";
import { countryName, countryFlag, sourceFavicon } from "@/lib/analytics/labels";

function FaviconImg({ source }: { source: string }) {
  const url = sourceFavicon(source);
  if (!url) return <Globe size={15} className="dfa-faint" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={16} height={16} className="dfa-favicon-img" />;
}

function deviceIcon(key: string): ReactNode {
  if (key === "mobile") return <Smartphone size={15} />;
  if (key === "tablet") return <Tablet size={15} />;
  return <Monitor size={15} />;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const SOURCES_TABS: TabDef[] = [
  {
    key: "channel",
    label: "Channel",
    dim: "channel",
    filterKey: "channel",
    renderRow: (k) => ({ label: k }),
  },
  {
    key: "referrer",
    label: "Referrer",
    dim: "referrer",
    filterKey: "source",
    renderRow: (k) => ({ icon: <FaviconImg source={k} />, label: k }),
  },
  {
    key: "campaign",
    label: "Campaign",
    dim: "campaign",
    filterKey: "campaign",
    renderRow: (k) => ({ label: k }),
  },
];

const PAGES_TABS: TabDef[] = [
  { key: "hostname", label: "Hostname", dim: "hostname", filterKey: "hostname", renderRow: (k) => ({ label: k }) },
  { key: "page", label: "Page", dim: "page", filterKey: "path", renderRow: (k) => ({ label: k }) },
  { key: "entry", label: "Entry page", dim: "entry", filterKey: "path", renderRow: (k) => ({ label: k }) },
  { key: "exit", label: "Exit page", dim: "exit", filterKey: "path", renderRow: (k) => ({ label: k }) },
];

const GEO_TABS: TabDef[] = [
  {
    key: "map",
    label: "Map",
    placeholder: (
      <div className="dfa-connect-note">
        <MapIcon size={20} className="dfa-faint" />
        <p>Harta interactivă world vine în M7 (polish).</p>
        <span className="dfa-muted">Folosește tab-ul Country între timp.</span>
      </div>
    ),
  },
  {
    key: "country",
    label: "Country",
    dim: "country",
    filterKey: "country",
    renderRow: (k) => ({ icon: <span className="dfa-flag">{countryFlag(k)}</span>, label: countryName(k) }),
  },
  { key: "region", label: "Region", dim: "region", filterKey: "region", renderRow: (k) => ({ label: k }) },
  { key: "city", label: "City", dim: "city", filterKey: "city", renderRow: (k) => ({ label: k }) },
];

const TECH_TABS: TabDef[] = [
  { key: "browser", label: "Browser", dim: "browser", filterKey: "browser", renderRow: (k) => ({ label: k }) },
  { key: "os", label: "OS", dim: "os", filterKey: "os", renderRow: (k) => ({ label: k }) },
  {
    key: "device",
    label: "Device",
    dim: "device",
    filterKey: "device",
    renderRow: (k) => ({ icon: deviceIcon(k), label: cap(k) }),
  },
];

export function Panels({
  breakdowns,
  loading,
  onFilter,
  sitePublicId,
  from,
  to,
  pathFilter,
}: {
  breakdowns: Breakdowns | null;
  loading: boolean;
  onFilter: (key: keyof Filters, value: string) => void;
  sitePublicId: string;
  from: string;
  to: string;
  pathFilter?: string;
}) {
  const [modalTab, setModalTab] = useState<TabDef | null>(null);
  const [modalRows, setModalRows] = useState<BreakdownRow[]>([]);

  const openDetails = (tab: TabDef, rows: BreakdownRow[]) => {
    setModalTab(tab);
    setModalRows(rows);
  };

  const sourcesTabs: TabDef[] = [
    ...SOURCES_TABS,
    {
      key: "keyword",
      label: "Keyword",
      node: <KeywordTab site={sitePublicId} from={from} to={to} path={pathFilter} />,
    },
  ];

  return (
    <>
      <div className="dfa-panels-grid">
        <BreakdownPanel tabs={sourcesTabs} breakdowns={breakdowns} loading={loading} onFilter={onFilter} onDetails={openDetails} />
        <BreakdownPanel tabs={PAGES_TABS} breakdowns={breakdowns} loading={loading} onFilter={onFilter} onDetails={openDetails} />
        <BreakdownPanel tabs={GEO_TABS} breakdowns={breakdowns} loading={loading} defaultTab={1} onFilter={onFilter} onDetails={openDetails} />
        <BreakdownPanel tabs={TECH_TABS} breakdowns={breakdowns} loading={loading} onFilter={onFilter} onDetails={openDetails} />
      </div>
      <BreakdownModal
        tab={modalTab}
        rows={modalRows}
        onClose={() => setModalTab(null)}
        onFilter={onFilter}
      />
    </>
  );
}

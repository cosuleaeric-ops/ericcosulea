"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { BreakdownRow } from "@/lib/analytics/queries";
import { countryName } from "@/lib/analytics/labels";
import { formatNumber } from "@/lib/analytics/format";

const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Diferențe de denumire față de world-atlas.
const ATLAS_ALIAS: Record<string, string> = {
  "United States": "United States of America",
};

type GeoFeature = {
  type: "Feature";
  properties: { name: string };
  geometry: unknown;
};

let cachedFeatures: GeoFeature[] | null = null;

export function WorldMap({ data }: { data: BreakdownRow[] }) {
  const [features, setFeatures] = useState<GeoFeature[] | null>(cachedFeatures);
  const [tip, setTip] = useState<{ name: string; value: number; x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cachedFeatures) return;
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((topo: any) => {
        const fc = feature(topo, topo.objects.countries) as unknown as {
          features: GeoFeature[];
        };
        cachedFeatures = fc.features;
        if (!cancelled) setFeatures(fc.features);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { valueByName, max } = useMemo(() => {
    const m = new Map<string, number>();
    let mx = 0;
    for (const d of data) {
      const name = countryName(d.key);
      const atlas = (ATLAS_ALIAS[name] ?? name).toLowerCase();
      m.set(atlas, d.value);
      if (d.value > mx) mx = d.value;
    }
    return { valueByName: m, max: mx };
  }, [data]);

  const W = 760;
  const H = 380;
  const pathGen = useMemo(() => {
    if (!features) return null;
    const projection = geoNaturalEarth1().fitSize(
      [W, H],
      { type: "FeatureCollection", features } as never,
    );
    return geoPath(projection);
  }, [features]);

  if (!features || !pathGen) {
    return (
      <div className="dfa-map-skel">
        <div className="dfa-skeleton" style={{ height: 200, borderRadius: 12 }} />
      </div>
    );
  }

  function fillFor(value: number | undefined): string {
    if (!value || !max) return "var(--dfa-panel-hover)";
    const t = 0.18 + (value / max) * 0.82;
    return `color-mix(in srgb, var(--dfa-chart) ${Math.round(t * 100)}%, var(--dfa-panel))`;
  }

  return (
    <div className="dfa-map" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet">
        {features.map((f, i) => {
          const value = valueByName.get(f.properties.name.toLowerCase());
          return (
            <path
              key={i}
              d={pathGen(f as never) ?? undefined}
              fill={fillFor(value)}
              stroke="var(--dfa-bg)"
              strokeWidth={0.4}
              className={value ? "dfa-map-country has-data" : "dfa-map-country"}
              onMouseEnter={(e) => {
                if (!value) return;
                const rect = wrapRef.current?.getBoundingClientRect();
                setTip({
                  name: f.properties.name,
                  value,
                  x: e.clientX - (rect?.left ?? 0),
                  y: e.clientY - (rect?.top ?? 0),
                });
              }}
              onMouseMove={(e) => {
                if (!value) return;
                const rect = wrapRef.current?.getBoundingClientRect();
                setTip((t) =>
                  t ? { ...t, x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) } : t,
                );
              }}
              onMouseLeave={() => setTip(null)}
            />
          );
        })}
      </svg>
      {tip && (
        <div className="dfa-map-tip" style={{ left: tip.x + 12, top: tip.y + 12 }}>
          <strong>{tip.name}</strong> · {formatNumber(tip.value)} visitors
        </div>
      )}
    </div>
  );
}

"use client";
import { useId } from "react";
import { caleLina } from "./curba";

export function Sparkline({
  data,
  height = 56,
  delay = 0,
}: {
  data: number[];
  height?: number;
  delay?: number;
}) {
  const id = useId();
  const clipId = `clip-${id}`;
  const w = 240;
  const h = height;
  const pad = 4;
  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (w - pad * 2) + pad);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const pts: [number, number][] = data.map((v, i) => [x(i), y(v)]);
  const line = caleLina(pts);
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z` : "";

  // draw-in EXACT ca Recharts/DataFast: clip-wipe stânga→dreapta, 1500ms, easing "ease" — pur CSS
  return (
    <svg className="dfa-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dfa-chart)" stopOpacity={0.32} />
          <stop offset="100%" stopColor="var(--dfa-chart)" stopOpacity={0} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect
            className="dfa-spark-clip"
            x={0}
            y={0}
            width={w}
            height={h}
            style={{ ["--dfa-spark-w"]: `${w}px`, ["--dfa-spark-delay"]: `${delay}s` } as React.CSSProperties}
          />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d={area} fill={`url(#sg-${id})`} />
        <path d={line} fill="none" stroke="var(--dfa-chart)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

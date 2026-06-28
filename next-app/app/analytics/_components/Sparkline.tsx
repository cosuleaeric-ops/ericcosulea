"use client";
import { useId } from "react";

// Sparkline SVG ușor (area + line) cu gradient.
export function Sparkline({ data, height = 56 }: { data: number[]; height?: number }) {
  const id = useId();
  const w = 240;
  const h = height;
  const pad = 4;
  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (w - pad * 2) + pad);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z`;

  return (
    <svg className="dfa-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dfa-chart)" stopOpacity={0.32} />
          <stop offset="100%" stopColor="var(--dfa-chart)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg-${id})`} />
      <path d={line} fill="none" stroke="var(--dfa-chart)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

"use client";
import { useId } from "react";
import { motion } from "framer-motion";

// Spline cubic MONOTON (Fritsch–Carlson): neted, dar nu depășește valorile punctelor.
function monotoneLine(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const dx: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i];
    delta[i] = (ys[i + 1] - ys[i]) / dx[i];
  }

  const m: number[] = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / delta[i];
    const b = m[i + 1] / delta[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * delta[i];
      m[i + 1] = t * b * delta[i];
    }
  }

  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1x = xs[i] + dx[i] / 3;
    const c1y = ys[i] + (m[i] * dx[i]) / 3;
    const c2x = xs[i + 1] - dx[i] / 3;
    const c2y = ys[i + 1] - (m[i + 1] * dx[i]) / 3;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${xs[i + 1].toFixed(1)},${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

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
  const line = monotoneLine(pts);
  const area = n > 0 ? `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z` : "";

  // draw-in EXACT ca Recharts/DataFast: clip-wipe stânga→dreapta, 1500ms, easing "ease"
  const reveal = { duration: 1.5, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] };

  return (
    <svg className="dfa-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--dfa-chart)" stopOpacity={0.32} />
          <stop offset="100%" stopColor="var(--dfa-chart)" stopOpacity={0} />
        </linearGradient>
        <clipPath id={clipId}>
          <motion.rect x={0} y={0} height={h} initial={{ width: 0 }} animate={{ width: w }} transition={reveal} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d={area} fill={`url(#sg-${id})`} />
        <path d={line} fill="none" stroke="var(--dfa-chart)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

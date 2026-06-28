"use client";
import { useId } from "react";

// Curbă netedă (Catmull-Rom → bezier), ca să nu fie tranziții unghiulare.
function smoothLine(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function Sparkline({ data, height = 56 }: { data: number[]; height?: number }) {
  const id = useId();
  const w = 240;
  const h = height;
  const pad = 4;
  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (w - pad * 2) + pad);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const pts: [number, number][] = data.map((v, i) => [x(i), y(v)]);
  const line = smoothLine(pts);
  const area =
    n > 0 ? `${line} L${x(n - 1).toFixed(1)},${h} L${x(0).toFixed(1)},${h} Z` : "";

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

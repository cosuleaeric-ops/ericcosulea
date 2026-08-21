"use client";
import { useId } from "react";

// Spline Catmull-Rom: tangenta fiecarui punct urmeaza directia vecinilor, deci
// urcarile si coborarile curg in loc sa se franga. Spre deosebire de splineul
// monoton, poate depasi putin valorile punctelor, asa ca tin punctele de
// control in banda desenabila — o curba nu are voie sa iasa din grafic.
function naturalLine(pts: [number, number][], sus: number, jos: number): string {
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;

  const prinde = (v: number) => Math.min(jos, Math.max(sus, v));
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i - 1] ?? pts[i];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[i + 2] ?? pts[i + 1];
    const c1x = x1 + (x2 - x0) / 6;
    const c1y = prinde(y1 + (y2 - y0) / 6);
    const c2x = x2 - (x3 - x1) / 6;
    const c2y = prinde(y2 - (y3 - y1) / 6);
    d += ` C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(x2)},${f(y2)}`;
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
  const line = naturalLine(pts, y(max), y(0));
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

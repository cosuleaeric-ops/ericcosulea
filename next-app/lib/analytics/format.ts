// Formatare pură (client + server).

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}m ${rem}s`;
}

export function formatPct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export type DeltaDisplay = {
  text: string;
  dir: "up" | "down" | "flat" | "new";
};

// good=true → creșterea e pozitivă (verde); pentru bounce rate good=false.
export function deltaDisplay(
  delta: number | null,
  good = true,
): DeltaDisplay {
  if (delta === null) return { text: "new", dir: "new" };
  const rounded = Math.round(delta);
  if (rounded === 0) return { text: "0%", dir: "flat" };
  const up = rounded > 0;
  const sign = up ? "↑" : "↓";
  const positive = good ? up : !up;
  return {
    text: `${Math.abs(rounded)}% ${sign}`,
    dir: positive ? "up" : "down",
  };
}

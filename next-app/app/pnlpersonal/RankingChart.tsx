"use client";

import { Bar } from "react-chartjs-2";
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const fmt = (n: number) => new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

type Datum = { categorie: string; suma: number };

export default function RankingChart({ data, colors }: { data: Datum[]; colors: string[] }) {
  return (
    <Bar
      data={{
        labels: data.map((c) => c.categorie),
        datasets: [{
          data: data.map((c) => c.suma),
          backgroundColor: colors.slice(0, data.length),
          borderRadius: 4,
          borderSkipped: false,
        }],
      }}
      options={{
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${fmt(ctx.parsed.x as number)} lei` } },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: "#F0EDE6" },
            ticks: { callback: (v) => `${fmt(v as number)} lei`, font: { size: 11 } },
          },
          y: { grid: { display: false }, ticks: { font: { size: 12 } } },
        },
      }}
    />
  );
}

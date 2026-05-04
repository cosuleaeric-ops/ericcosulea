const NS = "urn:schemas-microsoft-com:office:spreadsheet";

export type Product = {
  name: string;
  qty: number;
  venit: number;
  discount: number;
  incasat: number;
  tva: number;
  net: number;
};

export type ParsedReport = {
  sections: string[];
  products: Product[];
  ambalajTotal: number;
};

export function parseBreezeXls(content: string): ParsedReport {
  const stripped = content.replace(/^﻿/, "");

  const sectionRegex = /MergeAcross="9"[\s\S]*?<ss:Data[^>]*>([\s\S]*?)<\/ss:Data>/g;
  const sections: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = sectionRegex.exec(stripped))) {
    const raw = m[1].replace(/<[^>]+>/g, "").trim();
    const nameMatch = raw.match(/^(\S+)\s+Total\s*->/i);
    if (nameMatch) sections.push(nameMatch[1]);
  }
  if (sections.length === 0) {
    throw new Error("Nu s-a găsit nicio secțiune. Verifică că ai încărcat un export Breeze valid.");
  }

  const restaurantIdx = sections.findIndex((s) => s.toLowerCase() === "restaurant");
  if (restaurantIdx === -1) {
    throw new Error(`Secțiunea "Restaurant" nu a fost găsită. Secțiuni detectate: ${sections.join(", ")}.`);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(stripped, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Fișierul nu este un XML valid.");
  }

  const rows = Array.from(doc.getElementsByTagNameNS(NS, "Row"));
  let sectionIdx = -1;
  let inRestaurant = false;
  const products: Product[] = [];

  for (const row of rows) {
    const cells = Array.from(row.getElementsByTagNameNS(NS, "Cell"));
    if (cells.length === 0) continue;

    if (cells.length === 1) {
      const merge = cells[0].getAttributeNS(NS, "MergeAcross");
      if (merge !== null && Number(merge) >= 5) {
        sectionIdx += 1;
        inRestaurant = (sections[sectionIdx]?.toLowerCase() === "restaurant");
      }
      continue;
    }

    const cellData = (i: number) => {
      const cell = cells[i];
      if (!cell) return "";
      const data = cell.getElementsByTagNameNS(NS, "Data")[0];
      return data ? data.textContent ?? "" : "";
    };

    const d0 = cellData(0);
    const d1 = cellData(1);
    if (!d0 && d1.startsWith("Total:")) {
      inRestaurant = false;
      continue;
    }
    if (d0 === "Produs") continue;

    if (inRestaurant && cells.length >= 7) {
      products.push({
        name: d0.trim(),
        qty: Number(cellData(1)) || 0,
        venit: Number(cellData(3)) || 0,
        discount: Number(cellData(5)) || 0,
        incasat: Number(cellData(6)) || 0,
        tva: Number(cellData(8)) || 0,
        net: Number(cellData(9)) || 0,
      });
    }
  }

  if (products.length === 0) {
    throw new Error("Secțiunea Restaurant nu conține produse. Verifică formatul fișierului.");
  }

  let ambalajTotal = 0;
  for (const row of rows) {
    const cells = Array.from(row.getElementsByTagNameNS(NS, "Cell"));
    if (cells.length < 7) continue;
    const d0 = cells[0].getElementsByTagNameNS(NS, "Data")[0]?.textContent ?? "";
    const d6 = cells[6].getElementsByTagNameNS(NS, "Data")[0]?.textContent ?? "";
    if (!d0 || !d6) continue;
    if (/ambalaj/i.test(d0)) {
      ambalajTotal += Number(d6) || 0;
    }
  }

  return { sections, products, ambalajTotal };
}

export type RestaurantKey = "gustoria" | "hotdog" | "turmerizza" | "dogu";

export type RestaurantBreakdown = {
  total: number;
  gustoria: number;
  hotdog: number;
  turmerizza: number;
  dogu: number;
  ambalaj: number;
  byCategory: Record<RestaurantKey, Product[]>;
};

export function buildBreakdown(report: ParsedReport): RestaurantBreakdown {
  const breakdown: RestaurantBreakdown = {
    total: 0,
    gustoria: 0,
    hotdog: 0,
    turmerizza: 0,
    dogu: 0,
    ambalaj: report.ambalajTotal,
    byCategory: { gustoria: [], hotdog: [], turmerizza: [], dogu: [] },
  };

  for (const p of report.products) {
    breakdown.total += p.incasat;
    const lower = p.name.toLowerCase();
    if (p.name.includes("100g") || lower.includes("gustoria")) {
      breakdown.gustoria += p.incasat;
      breakdown.byCategory.gustoria.push(p);
    } else if (lower.includes("hotdog")) {
      breakdown.hotdog += p.incasat;
      breakdown.byCategory.hotdog.push(p);
    } else if (lower.includes("pizza")) {
      breakdown.turmerizza += p.incasat;
      breakdown.byCategory.turmerizza.push(p);
    } else {
      breakdown.dogu += p.incasat;
      breakdown.byCategory.dogu.push(p);
    }
  }

  return breakdown;
}

export function formatRon(v: number): string {
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + " RON";
}

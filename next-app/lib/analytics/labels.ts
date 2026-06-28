// Etichete pentru breakdown-uri (client + server). Pur.

const COUNTRY_NAMES: Record<string, string> = {
  RO: "Romania",
  MD: "Moldova",
  DE: "Germany",
  IT: "Italy",
  ES: "Spain",
  GB: "United Kingdom",
  US: "United States",
  FR: "France",
  IN: "India",
  NL: "Netherlands",
  AT: "Austria",
  BE: "Belgium",
  AD: "Andorra",
  CN: "China",
  MA: "Morocco",
  PT: "Portugal",
  PL: "Poland",
  HU: "Hungary",
  BG: "Bulgaria",
  GR: "Greece",
  CH: "Switzerland",
  IE: "Ireland",
  SE: "Sweden",
  CA: "Canada",
  AU: "Australia",
  UA: "Ukraine",
  RS: "Serbia",
  TR: "Turkey",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "🏳️";
  const base = 0x1f1e6;
  const cc = code.toUpperCase();
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65),
  );
}

// Domeniul folosit pentru favicon-ul sursei de trafic.
const SOURCE_DOMAINS: Record<string, string> = {
  Google: "google.com",
  Bing: "bing.com",
  Yahoo: "yahoo.com",
  DuckDuckGo: "duckduckgo.com",
  Ecosia: "ecosia.org",
  Yandex: "yandex.com",
  Baidu: "baidu.com",
  Facebook: "facebook.com",
  Instagram: "instagram.com",
  "Twitter/X": "x.com",
  LinkedIn: "linkedin.com",
  Reddit: "reddit.com",
  YouTube: "youtube.com",
  GitHub: "github.com",
  Telegram: "telegram.org",
  Pinterest: "pinterest.com",
  TikTok: "tiktok.com",
};

export function sourceFavicon(source: string): string | null {
  if (source === "Direct/None") return null;
  const domain = SOURCE_DOMAINS[source] ?? (source.includes(".") ? source : null);
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;
}

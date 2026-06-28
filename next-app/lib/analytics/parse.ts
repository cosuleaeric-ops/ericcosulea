// Parsing ușor pentru ingest (fără dependențe externe).

export type Device = "desktop" | "mobile" | "tablet";

export function parseUserAgent(ua: string | null | undefined): {
  browser: string;
  os: string;
  device: Device;
} {
  const s = ua ?? "";

  // ── OS ──
  let os = "Unknown";
  if (/Windows NT/i.test(s)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/CrOS/i.test(s)) os = "Chrome OS";
  else if (/Linux/i.test(s)) os = "Linux";

  // ── Browser (ordinea contează) ──
  let browser = "Unknown";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/SamsungBrowser/i.test(s)) browser = "Samsung Internet";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Chrome\//i.test(s)) browser = "Chrome";
  else if (/Safari\//i.test(s)) browser = "Safari";

  // ── Device ──
  let device: Device = "desktop";
  if (/iPad|Tablet|PlayBook|(Android(?!.*Mobile))/i.test(s)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(s))
    device = "mobile";

  return { browser, os, device };
}

// Mapează hostname-ul referrer-ului într-o sursă lizibilă.
const REFERRER_MAP: Array<[RegExp, string]> = [
  [/(^|\.)google\./i, "Google"],
  [/(^|\.)bing\.com/i, "Bing"],
  [/(^|\.)yahoo\./i, "Yahoo"],
  [/duckduckgo\.com/i, "DuckDuckGo"],
  [/(^|\.)ecosia\.org/i, "Ecosia"],
  [/(^|\.)yandex\./i, "Yandex"],
  [/(^|\.)baidu\.com/i, "Baidu"],
  [/(^|\.)facebook\.com|(^|\.)fb\.com/i, "Facebook"],
  [/(^|\.)instagram\.com/i, "Instagram"],
  [/(^|\.)t\.co$|(^|\.)twitter\.com|(^|\.)x\.com/i, "Twitter/X"],
  [/(^|\.)linkedin\.com|lnkd\.in/i, "LinkedIn"],
  [/(^|\.)reddit\.com/i, "Reddit"],
  [/(^|\.)youtube\.com|youtu\.be/i, "YouTube"],
  [/(^|\.)github\.com/i, "GitHub"],
  [/(^|\.)t\.me|telegram/i, "Telegram"],
  [/(^|\.)pinterest\./i, "Pinterest"],
  [/(^|\.)tiktok\.com/i, "TikTok"],
];

export function referrerSource(
  referrer: string | null | undefined,
  selfDomain?: string | null,
): string {
  if (!referrer) return "Direct/None";
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "Direct/None";
  }
  if (!host) return "Direct/None";
  if (selfDomain && host.replace(/^www\./, "") === selfDomain.replace(/^www\./, ""))
    return "Direct/None";

  for (const [re, name] of REFERRER_MAP) {
    if (re.test(host)) return name;
  }
  return host;
}

export function parseUtm(urlString: string | null | undefined): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
} {
  const empty = { utmSource: null, utmMedium: null, utmCampaign: null };
  if (!urlString) return empty;
  try {
    const u = new URL(urlString, "https://x");
    return {
      utmSource: u.searchParams.get("utm_source"),
      utmMedium: u.searchParams.get("utm_medium"),
      utmCampaign: u.searchParams.get("utm_campaign"),
    };
  } catch {
    return empty;
  }
}

// Channel = gruparea de nivel înalt a sursei (pentru tab-ul Channel).
export function channelOf(
  referrerSrc: string,
  utmMedium: string | null,
): string {
  const m = (utmMedium ?? "").toLowerCase();
  if (m.includes("cpc") || m.includes("ppc") || m.includes("paid"))
    return "Paid Search";
  if (m.includes("email")) return "Email";
  if (m.includes("social")) return "Social";
  if (referrerSrc === "Direct/None") return "Direct";
  if (["Google", "Bing", "Yahoo", "DuckDuckGo", "Ecosia", "Yandex", "Baidu"].includes(referrerSrc))
    return "Organic Search";
  if (["Facebook", "Instagram", "Twitter/X", "LinkedIn", "Reddit", "YouTube", "TikTok", "Pinterest", "Telegram"].includes(referrerSrc))
    return "Social";
  return "Referral";
}

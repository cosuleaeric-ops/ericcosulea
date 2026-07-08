// Helpere partajate EliteMail.

// GIF transparent 1×1 (43 bytes) — răspunsul pixelului de open tracking.
const PIXEL_B64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
export const PIXEL = Buffer.from(PIXEL_B64, "base64");

export const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(PIXEL.length),
  // Fără cache: vrem ca fiecare re-deschidere să re-tragă pixelul.
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

// Prefetch/scannere care deschid pixeli sau ating linkuri fără intervenția omului:
// Apple Mail Privacy Protection, Outlook SafeLinks/ATP, filtre spam, monitoare.
// NU includem GoogleImageProxy / YahooMailProxy — acelea sunt open-uri reale
// (Gmail/Yahoo proxează imaginea CÂND destinatarul deschide mailul).
const BOT_UA =
  /bot|crawl|spider|slurp|preview|scan|monitor|proofpoint|barracuda|mimecast|safelinks|forcepoint|symantec|microsoft office|ms-office|bingpreview|headless|python-requests|axios|curl|wget|okhttp|go-http|node-fetch|facebookexternalhit/i;

export function looksLikeBot(ua: string | null): boolean {
  if (!ua) return true; // fără user-agent = aproape sigur script/scanner
  return BOT_UA.test(ua);
}

// Proxy-ul de imagini Gmail — sursă AMBIGUĂ: prin el trec și deschiderile destinatarului
// (dacă folosește Gmail), și ale proprietarului care se uită la propriul mail în Gmail.
// DOAR pentru acestea au sens ferestrele grace/owner-seen; un fetch direct de pe un IP
// străin cu UA normal nu poate fi al proprietarului și nu se suprimă niciodată.
export const GOOGLE_PROXY_RX = /googleimageproxy|ggpht\.com/i;
export function isGoogleProxy(ua: string | null): boolean {
  return !!ua && GOOGLE_PROXY_RX.test(ua);
}

export function clientIp(h: Headers): string | null {
  const fwd = h.get("x-vercel-forwarded-for") || h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
}

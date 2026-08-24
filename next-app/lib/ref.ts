// Marchez linkurile dintre site-urile mele, ca traficul trimis de pe unul pe
// altul să se vadă în EliteData chiar și când browserul nu trimite referrer
// (Safari cu prevenire de urmărire, aplicații care deschid linkul, HTTPS→HTTP).

const REF = "ericcosulea.ro";

// Profilurile de rețele sociale nu sunt site-urile mele și oricum ignoră
// parametrul, deci nu are rost să-l pun acolo.
const RETELE = [
  "instagram.com",
  "facebook.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
];

export function cuRef(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return url;
    const gazda = u.hostname.replace(/^www\./, "");
    if (RETELE.some((r) => gazda === r || gazda.endsWith("." + r))) return url;
    if (u.searchParams.has("ref")) return url; // deja marcat, nu-l suprascriu
    u.searchParams.set("ref", REF);
    return u.toString();
  } catch {
    return url;
  }
}

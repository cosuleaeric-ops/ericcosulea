// Emojiul categoriilor sta aici, nu in numele din DB: numele raman curate ("Groceries"),
// ca sa mearga autocompletarea dupa primele litere, iar afisarea e "🍎 Groceries".

const CHELT_EMOJI: Record<string, string> = {
  "Abonamente": "📺",
  "Altele": "📦",
  "Bucatarie": "🍽️",
  "Băuturi": "☕",
  "Cadou": "🎁",
  "Cafea": "☕",
  "Casa": "🏠",
  "Chirie": "🏠",
  "Creatina": "🧪",
  "Dentist": "🦷",
  "Donatie": "💵",
  "Farmacie": "💊",
  "Fast-food": "🍔",
  "Fun": "🎳",
  "Groceries": "🍎",
  "Haine": "👚",
  "Igiena": "🧼",
  "Luca": "🥨",
  "Padel": "👟",
  "Parfum": "💐",
  "Proiecte": "💻",
  "Proteine": "🍗",
  "Rata PC": "🖥️",
  "Shopping": "🛍️",
  "Snacks": "🍫",
  "Suc": "🥤",
  "Teambuilding": "🧩",
  "Transport": "🚌",
  "Tuns": "💇‍♂️",
  "Zi de nastere": "🎁",
};

const VENIT_EMOJI: Record<string, string> = {
  "2Performant": "🔗",
  "Bunica": "👵",
  "Elite Experience": "✨",
  "Mama": "👩",
  "Profitshare": "🛒",
  "Salariu": "💼",
  "Trading212": "📈",
  "Vinted": "👕",
};

export type CatKind = "venit" | "cheltuiala";

export function catEmoji(nume: string, kind: CatKind): string {
  const map = kind === "venit" ? VENIT_EMOJI : CHELT_EMOJI;
  return map[nume.trim()] ?? (kind === "venit" ? "💰" : "💸");
}

/** Numele cu emojiul in fata: "Groceries" → "🍎 Groceries". */
export function catLabel(nume: string, kind: CatKind): string {
  const n = nume.trim();
  if (!n) return "—";
  return `${catEmoji(n, kind)} ${n}`;
}

// Cheile din site_texts. Fișier separat de actions.ts fiindcă un modul
// "use server" nu poate exporta decât funcții async.
export const CHEI = {
  blog: "reguli.blog",
  casutasmart: "reguli.casutasmart",
  cesaicumpar: "reguli.cesaicumpar",
  outglow: "reguli.outglow",
} as const;

export type NumeReguli = keyof typeof CHEI;
export type Reguli = Record<NumeReguli, string>;

export const GOALE: Reguli = { blog: "", casutasmart: "", cesaicumpar: "", outglow: "" };

// Cele trei de sub câmpul principal, în ordinea cerută.
export const SECUNDARE: { nume: NumeReguli; eticheta: string }[] = [
  { nume: "casutasmart", eticheta: "reguli Căsuța Smart" },
  { nume: "cesaicumpar", eticheta: "reguli Ce Să-i Cumpăr" },
  { nume: "outglow", eticheta: "reguli Outglow" },
];

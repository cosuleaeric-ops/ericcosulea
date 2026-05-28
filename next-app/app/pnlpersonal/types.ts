export type Venit = { id: number; data: string; descriere: string; suma: number };
export type Cheltuiala = { id: number; data: string; categorie: string; detalii: string; suma: number };
export type Portofel = { id: number; data: string; cash: number; ing: number; revolut: number; trading212: number };

export type PeriodOption = { value: string; label: string; isYear: boolean };

export type PnlDataInput = {
  initialMonth: string;
  loadedYear: string;
  availableMonths: string[];
  venituri: Venit[];
  cheltuieli: Cheltuiala[];
  portofel: Portofel[];
};

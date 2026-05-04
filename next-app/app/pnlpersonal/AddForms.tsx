"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addVenitAction,
  addCheltuialaAction,
  addPortofelAction,
  addCategorieVenitAction,
  addCategorieCheltuialaAction,
} from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? "..." : label}</button>;
}

const today = () => new Date().toISOString().slice(0, 10);

export function VenitForm({ categorii }: { categorii: string[] }) {
  const [state, action] = useActionState(addVenitAction, undefined);
  return (
    <form action={action} className="pnl-add-form">
      <input type="date" name="data" defaultValue={today()} required className="form-input" />
      <input type="text" name="descriere" placeholder="descriere (categorie)" list="venit-cats" required className="form-input" />
      <datalist id="venit-cats">{categorii.map((c) => <option key={c} value={c} />)}</datalist>
      <input type="number" step="0.01" name="suma" placeholder="suma" required className="form-input" />
      <Submit label="+ venit" />
      {state?.error && <span className="login-error">{state.error}</span>}
    </form>
  );
}

export function CheltuialaForm({ categorii }: { categorii: string[] }) {
  const [state, action] = useActionState(addCheltuialaAction, undefined);
  return (
    <form action={action} className="pnl-add-form">
      <input type="date" name="data" defaultValue={today()} required className="form-input" />
      <select name="categorie" required className="form-input" defaultValue="">
        <option value="" disabled>categorie</option>
        {categorii.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input type="text" name="detalii" placeholder="detalii (opțional)" className="form-input" />
      <input type="number" step="0.01" name="suma" placeholder="suma" required className="form-input" />
      <Submit label="+ cheltuială" />
      {state?.error && <span className="login-error">{state.error}</span>}
    </form>
  );
}

export function PortofelForm({ defaults }: { defaults: { cash: number; ing: number; revolut: number; trading212: number } | null }) {
  const [state, action] = useActionState(addPortofelAction, undefined);
  return (
    <form action={action} className="pnl-add-form pnl-portofel-form">
      <input type="date" name="data" defaultValue={today()} required className="form-input" />
      <input type="number" step="0.01" name="cash" defaultValue={defaults?.cash ?? 0} placeholder="cash" className="form-input" />
      <input type="number" step="0.01" name="ing" defaultValue={defaults?.ing ?? 0} placeholder="ing" className="form-input" />
      <input type="number" step="0.01" name="revolut" defaultValue={defaults?.revolut ?? 0} placeholder="revolut" className="form-input" />
      <input type="number" step="0.01" name="trading212" defaultValue={defaults?.trading212 ?? 0} placeholder="trading212" className="form-input" />
      <Submit label="+ snapshot" />
      {state?.error && <span className="login-error">{state.error}</span>}
    </form>
  );
}

export function CategorieVenitForm() {
  const [state, action] = useActionState(addCategorieVenitAction, undefined);
  return (
    <form action={action} className="pnl-add-form pnl-cat-form">
      <input type="text" name="nume" placeholder="categorie venit nouă" required className="form-input" />
      <Submit label="adaugă" />
      {state?.error && <span className="login-error">{state.error}</span>}
    </form>
  );
}

export function CategorieCheltuialaForm() {
  const [state, action] = useActionState(addCategorieCheltuialaAction, undefined);
  return (
    <form action={action} className="pnl-add-form pnl-cat-form">
      <input type="text" name="nume" placeholder="categorie cheltuială nouă (cu emoji ex. Cafea ☕)" required className="form-input" />
      <Submit label="adaugă" />
      {state?.error && <span className="login-error">{state.error}</span>}
    </form>
  );
}

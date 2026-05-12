"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { glovoReportAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? "se importă..." : "Importă fișiere →"}</button>;
}

export default function ImportForm() {
  const [state, formAction] = useActionState(glovoReportAction, undefined);
  return (
    <form action={formAction} className="reviews-form" encType="multipart/form-data">
      <div>
        <label className="form-label" htmlFor="glovo_xlsx">Fișiere export Glovo (.xlsx, multiple ok)</label>
        <input className="form-input" type="file" id="glovo_xlsx" name="glovo_xlsx" accept=".xlsx" multiple required />
      </div>
      <div className="form-actions">
        <SubmitButton />
      </div>
      {state?.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}

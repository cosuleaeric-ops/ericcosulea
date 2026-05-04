"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { importAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn" disabled={pending}>{pending ? "se importă..." : "Importă fișiere →"}</button>;
}

export default function ImportForm() {
  const [state, formAction] = useActionState(importAction, undefined);
  return (
    <form action={formAction} className="reviews-form" encType="multipart/form-data">
      <div className="form-row">
        <div>
          <label className="form-label" htmlFor="import_platform">Platformă</label>
          <select className="form-input" id="import_platform" name="platform" defaultValue="bolt" required>
            <option value="bolt">Bolt (.csv)</option>
            <option value="glovo">Glovo (.xlsx)</option>
          </select>
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label className="form-label" htmlFor="report_files">Fișiere export (multiple ok)</label>
          <input className="form-input" type="file" id="report_files" name="report_files" accept=".csv,.xlsx" multiple required />
        </div>
      </div>
      <div className="form-actions">
        <SubmitButton />
      </div>
      {state?.error && <p className="login-error">{state.error}</p>}
      {state?.success && <p className="reviews-success">{state.success}</p>}
    </form>
  );
}

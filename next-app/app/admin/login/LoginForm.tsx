"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  if (state?.ok) {
    return (
      <p className="page-lead">
        Dacă email-ul e corect, ți-am trimis un link de autentificare. Verifică inbox-ul (sau Spam).
      </p>
    );
  }

  return (
    <form action={action} className="login-form">
      <input
        type="email"
        name="email"
        placeholder="email"
        autoComplete="email"
        autoFocus
        required
        className="login-input"
      />
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "se trimite..." : "trimite link"}
      </button>
      {state?.error && <p className="login-error">{state.error}</p>}
    </form>
  );
}

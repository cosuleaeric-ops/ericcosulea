"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  if (state?.ok) {
    return (
      <p className="text-muted-foreground">
        Dacă email-ul e corect, ți-am trimis un link de autentificare. Verifică inbox-ul (sau Spam).
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <Input
        type="email"
        name="email"
        placeholder="email"
        autoComplete="email"
        autoFocus
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "se trimite..." : "trimite link"}
      </Button>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

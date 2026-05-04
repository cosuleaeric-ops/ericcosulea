import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "login - admin",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Link-ul nu conține un token.",
  invalid: "Link-ul a expirat sau a fost folosit deja. Cere unul nou.",
  denied: "Email-ul nu are acces.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

  return (
    <main className="page page-narrow">
      <section className="page-section">
        <h1 className="page-title">login</h1>
        {errorMessage && <p className="login-error">{errorMessage}</p>}
        <LoginForm />
      </section>
    </main>
  );
}

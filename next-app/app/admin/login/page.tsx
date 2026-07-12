import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "login - admin",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  missing: "Link-ul nu conține un token.",
  invalid: "Link-ul a expirat sau a fost folosit deja. Cere unul nou.",
  denied: "Email-ul nu are acces.",
  config: "Server-ul nu are SESSION_SECRET configurat.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : null;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl lowercase">login</CardTitle>
        </CardHeader>
        <CardContent>
          {errorMessage && <p className="mb-4 text-sm text-destructive">{errorMessage}</p>}
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}

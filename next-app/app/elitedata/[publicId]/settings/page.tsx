import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
import { SnippetBlock } from "./SnippetBlock";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const website = await getWebsiteByPublicId(publicId);
  if (!website) notFound();


  // Instalarea e prin PostHog (20 aug 2026). Scriptul propriu a plecat; ce
  // rămâne aici e reamintirea unde stă componenta care îl pornește.
  const snippet = `// src/components/posthog-init.tsx — pornit din layout-ul public
posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
  api_host: "/ingest",        // proxy same-origin (rewrites in next.config)
  ui_host: "https://eu.posthog.com",
  defaults: "2025-05-24",     // pageview pe navigatia SPA + pageleave
})`;



  return (
    <div className="dfa-settings">
      <a className="dfa-back" href={`/elitedata/${website.publicId}`}>
        <ArrowLeft size={15} /> {website.domain}
      </a>
      <h1 className="dfa-settings-title">Settings</h1>

      <section className="dfa-card dfa-settings-card">
        <h2>Install tracking</h2>
        <p className="dfa-muted">
          Pune snippet-ul în <code>&lt;head&gt;</code> pe <strong>{website.domain}</strong>.
          Pageview-urile apar imediat în dashboard.
        </p>
        <SnippetBlock code={snippet} />
        <p className="dfa-muted">
          Custom event-urile (goal-urile) se trimit în două feluri: din JS cu{" "}
          <code>window.elitedata(&quot;nume_event&quot;)</code>, sau declarativ, punând{" "}
          <code>elite-data-goal=&quot;nume_event&quot;</code> pe orice element — click-ul pe el
          (sau pe copiii lui) trimite event-ul automat.
        </p>
      </section>


      <section className="dfa-card dfa-settings-card">
        <h2>Exclude vizitele mele</h2>
        <p className="dfa-muted">
          Se face în cod, nu de aici: componenta care pornește PostHog verifică
          întâi cookie-ul de admin al site-ului și, dacă e pus, nu încarcă
          biblioteca deloc. Excluderea pe IP și <code>?elitedata_ignore</code>
          au plecat odată cu scriptul propriu (20 aug 2026).
        </p>
      </section>
    </div>
  );
}

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
import { listExcludedIps } from "@/lib/analytics/exclusions";
import { SnippetBlock } from "./SnippetBlock";
import { GscIntegration } from "./GscIntegration";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const website = await getWebsiteByPublicId(publicId);
  if (!website) notFound();

  const ownIps = await listExcludedIps();
  const optOutUrl = `https://${website.domain}/?elitedata_ignore=1`;

  const appUrl = process.env.APP_URL || "https://www.ericcosulea.ro";
  const snippet = `<script
  defer
  data-website-id="${website.publicId}"
  data-domain="${website.domain}"
  src="${appUrl}/js/script.js"
></script>`;

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
          <strong>Pe IP</strong> — de fiecare dată când deschizi acest dashboard, IP-ul de pe
          care vii e memorat și traficul de pe el nu se mai contorizează pe niciun site
          urmărit, în orice browser și de pe orice device din rețeaua aia. Se reînnoiește
          singur când providerul îți schimbă IP-ul; unul nefolosit 30 de zile e ignorat.
        </p>
        {ownIps.length > 0 && (
          <ul className="dfa-muted" style={{ margin: "0 0 1rem", paddingLeft: "1.1rem" }}>
            {ownIps.map((r) => (
              <li key={r.ip}>
                <code>{r.ip}</code> — {r.active ? "activ" : "expirat"}, ultima dată{" "}
                {r.lastSeenAt.toLocaleDateString("ro-RO", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </li>
            ))}
          </ul>
        )}
        <p className="dfa-muted">
          <strong>Pe browser</strong> — pentru când ești pe altă rețea (mobil, cafenea),
          deschide o dată link-ul de mai jos pe fiecare browser. Marchează browserul
          permanent, în localStorage <em>și</em> într-un cookie: dacă una dintre ele se
          șterge, cealaltă o rescrie. <code>?elitedata_ignore=0</code> anulează.
        </p>
        <p>
          <a href={optOutUrl} target="_blank" rel="noopener noreferrer">
            {optOutUrl}
          </a>
        </p>
      </section>

      <Suspense fallback={<div className="dfa-card dfa-settings-card"><div className="dfa-skeleton" style={{ height: 60 }} /></div>}>
        <GscIntegration sitePublicId={website.publicId} />
      </Suspense>
    </div>
  );
}

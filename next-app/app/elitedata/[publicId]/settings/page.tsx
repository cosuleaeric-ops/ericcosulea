import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getWebsiteByPublicId } from "@/lib/analytics/queries";
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
          Pageview-urile și custom event-urile (<code>window.datafast(&quot;nume&quot;)</code>)
          apar imediat în dashboard.
        </p>
        <SnippetBlock code={snippet} />
      </section>

      <Suspense fallback={<div className="dfa-card dfa-settings-card"><div className="dfa-skeleton" style={{ height: 60 }} /></div>}>
        <GscIntegration sitePublicId={website.publicId} />
      </Suspense>
    </div>
  );
}

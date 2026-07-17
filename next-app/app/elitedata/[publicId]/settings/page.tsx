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

  // Crawlerele AI (GPTBot, ClaudeBot, PerplexityBot…) nu rulează JS, deci scriptul
  // de sus nu le vede. Se prind server-side, cu un middleware Next.js/Vercel.
  const crawlerSnippet = `// middleware.ts — trimite crawlerele AI la EliteData
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";

const AI_CRAWLER_RE =
  /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|GoogleOther|Applebot|CCBot|Amazonbot|Bytespider|Meta-External|cohere|DuckAssistBot|YouBot|Diffbot|DeepSeek|QwenBot|xAI|Grok|Bingbot|YandexBot|Baiduspider/i;

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const ua = request.headers.get("user-agent") ?? "";
  if (AI_CRAWLER_RE.test(ua)) {
    event.waitUntil(
      fetch("${appUrl}/api/crawler", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "${website.publicId}", path: request.nextUrl.pathname, ua }),
      }).catch(() => {}),
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\\\..*).*)"],
};`;

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
        <h2>Track AI crawlers</h2>
        <p className="dfa-muted">
          GPTBot, ClaudeBot, PerplexityBot &amp; co. nu rulează JavaScript — scriptul de sus
          nu le vede. Pe un site Next.js/Vercel, pune (sau combină) acest{" "}
          <code>middleware.ts</code> în rădăcina proiectului <strong>{website.domain}</strong>.
          Vizitele lor apar în secțiunea <strong>Crawlere AI</strong> din dashboard.
        </p>
        <SnippetBlock code={crawlerSnippet} />
      </section>

      <Suspense fallback={<div className="dfa-card dfa-settings-card"><div className="dfa-skeleton" style={{ height: 60 }} /></div>}>
        <GscIntegration sitePublicId={website.publicId} />
      </Suspense>
    </div>
  );
}

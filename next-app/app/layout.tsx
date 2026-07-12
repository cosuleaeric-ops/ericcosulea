import type { Metadata } from "next";
import Script from "next/script";
import { Crimson_Pro } from "next/font/google";
import "./globals.css";
import "./site.css";
import AdminBarClient from "./AdminBarClient";
import { ADMIN_BAR_HIDDEN_PREFIXES, ADMIN_HINT_COOKIE } from "@/lib/admin-bar-paths";

const adminBarInitScript = `
(function () {
  if (document.cookie.indexOf("${ADMIN_HINT_COOKIE}=1") === -1) return;
  var p = location.pathname;
  var hidden = ${JSON.stringify(ADMIN_BAR_HIDDEN_PREFIXES)};
  for (var i = 0; i < hidden.length; i++) {
    var h = hidden[i];
    if (p === h || p.indexOf(h + "/") === 0) return;
  }
  document.documentElement.classList.add("admin-authed");
})();
`;

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  weight: ["400", "600", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Eric Cosulea",
  description: "speedrunning failures.",
  icons: { icon: "/assets/Logo3.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={crimsonPro.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: adminBarInitScript }} />
        <Script
          src="https://plausible.io/js/pa-U3QUedm8aW1g2Ou0qk-1J.js"
          strategy="afterInteractive"
          async
        />
        <Script id="plausible-init" strategy="afterInteractive">{`
          window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
          plausible.init();
        `}</Script>
        <Script
          src="/js/script.js"
          data-website-id="dfid_eric001"
          data-domain="ericcosulea.ro"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <AdminBarClient />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Script from "next/script";
import { Crimson_Pro } from "next/font/google";
import "./globals.css";
import "./site.css";
import AdminBar from "./AdminBar";

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
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
        <Script
          src="https://plausible.io/js/pa-U3QUedm8aW1g2Ou0qk-1J.js"
          strategy="afterInteractive"
          async
        />
        <Script id="plausible-init" strategy="afterInteractive">{`
          window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
          plausible.init();
        `}</Script>
      </head>
      <body>
        <AdminBar />
        {children}
      </body>
    </html>
  );
}

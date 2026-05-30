import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Inter } from "next/font/google";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EliteDeux",
  robots: { index: false, follow: false },
  manifest: "/elite-deux/manifest.json",
  icons: { icon: "/elite-deux/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function EliteDeuxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`elite-deux-root ${inter.variable} ${inter.className} ${bebasNeue.variable}`}>
      <link rel="stylesheet" href="/elite-deux/styles.css?v=6" />
      {children}
    </div>
  );
}

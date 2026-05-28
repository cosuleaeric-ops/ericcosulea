import type { Metadata, Viewport } from "next";
import { Bebas_Neue, IBM_Plex_Sans } from "next/font/google";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex",
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
    <div className={`${bebasNeue.variable} ${ibmPlexSans.variable}`}>
      <link rel="stylesheet" href="/elite-deux/styles.css" />
      {children}
    </div>
  );
}

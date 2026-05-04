import type { Metadata, Viewport } from "next";

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
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/elite-deux/styles.css" />
      {children}
    </>
  );
}

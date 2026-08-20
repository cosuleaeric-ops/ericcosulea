import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "4v3qkr3mrjun3eft.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["chart.js", "react-chartjs-2", "xlsx", "lucide-react"],
  },
  async headers() {
    return [
      {
        // Permite service worker-ului EliteDeux să controleze pagina /elite-deux
        // (fără slash final), altfel scope-ul lui e limitat la /elite-deux/.
        source: "/elite-deux/sw.js",
        headers: [{ key: "Service-Worker-Allowed", value: "/elite-deux" }],
      },
    ];
  },
  // PostHog e proxy-uit same-origin prin /ingest, ca adblockerele să nu taie
  // telemetria.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

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
  async redirects() {
    return [
      { source: "/analytics", destination: "/elitedata", permanent: true },
      { source: "/analytics/:path*", destination: "/elitedata/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

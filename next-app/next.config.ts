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
    optimizePackageImports: ["chart.js", "react-chartjs-2", "xlsx"],
  },
};

export default nextConfig;

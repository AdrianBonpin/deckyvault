import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Elysia is Bun-native and must not be bundled by Next.js
  serverExternalPackages: ["elysia", "@elysiajs/eden"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.akamai.steamstatic.com",
        port: "",
        pathname: "/steam/apps/**",
      },
      {
        protocol: "https",
        hostname: "shared.akamai.steamstatic.com",
        port: "",
        pathname: "/store_item_assets/**",
      },
      {
        protocol: "https",
        hostname: "cdn.steamgriddb.com",
      },
      {
        protocol: "https",
        hostname: "cdn2.steamgriddb.com",
      }
    ],
  },
};

export default nextConfig;

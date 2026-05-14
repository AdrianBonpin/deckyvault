import type { NextConfig } from "next";
import withSerwist from "@serwist/next";
import { version } from "./package.json";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  // Elysia is Bun-native and must not be bundled by Next.js
  serverExternalPackages: ["elysia", "@elysiajs/eden", "@elysia/openapi", "@elysia/cron"],
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
      },
      // Google
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com'
      },
      // Discord
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com'
      },
      // Cloudflare R2
      {
        protocol: "https",
        hostname: "cdn.deckyvault.xyz",
      }
    ],
  },
};

export default withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);

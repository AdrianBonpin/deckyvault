import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Elysia is Bun-native and must not be bundled by Next.js
  serverExternalPackages: ["elysia", "@elysiajs/eden"],
};

export default nextConfig;

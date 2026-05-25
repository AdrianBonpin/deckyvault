import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: [],
    // drizzle-orm ships ESM files that only contain sourceMappingURL references
    // (e.g. operations.js has no actual re-exports), which breaks named-export
    // resolution between test files.  Inlining lets Vite process the CJS
    // fallback and provide proper named exports.
    deps: {
      inline: ["drizzle-orm", "drizzle-orm/pg-core", "drizzle-orm/node-postgres"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
})

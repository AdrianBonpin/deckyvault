import { treaty } from "@elysia/eden"
import type { App } from "@/app/api/[[...slugs]]/route"

// Use require() on the server branch to prevent the client bundler from
// pulling in Elysia and the route module. The typeof window check is the
// standard Next.js server-vs-client guard.
export const api =
  typeof window === "undefined"
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      treaty((require("../app/api/[[...slugs]]/route") as { app: App }).app).api
    : treaty<App>(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").api

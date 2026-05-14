# Landing Page, SteamDB, Security & Changelog — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add landing page sections, SteamDB version auto-fetch in the submit wizard, tiered API rate limiting + anti-spam, and version bump to 2026.0.101.

**Architecture:** Four additive streams with no shared state. Security (Stream C) ships first as foundation, then SteamDB integration (Stream A) for the wizard, then the landing page redesign (Stream B), and finally changelog/docs (Stream D). All changes are additive — no DB migrations, no breaking API changes.

**Tech Stack:** Next.js 16, React 19, Elysia (Bun-compatible API), Drizzle ORM, PostgreSQL, Tailwind CSS v4, motion (framer-motion fork), Vitest

---

## Phase 1: API Security & Rate Limiting (Stream C)

### Task 1.1: Tiered Rate Limit Categories

**Files:**
- Modify: `lib/auth/rate-limit.ts`
- Modify: `lib/api/app.ts`

- [ ] **Step 1: Extend rateLimit to support named categories**

Rewrite `lib/auth/rate-limit.ts` to accept a `category` string parameter that partitions the store:

```ts
import { Elysia } from "elysia"

type RateLimitEntry = {
  count: number
  resetAt: number
}

// NOTE: This is an in-memory rate limiter for development/single-instance
// deployments. For production with multiple instances or serverless, use a
// shared store like Redis or Upstash.
const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return "unknown"
}

function checkRateLimit(
  key: string,
  window: number,
  max: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + window * 1000
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: max - 1, resetAt }
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

const CATEGORY_LIMITS: Record<string, { window: number; max: number }> = {
  default: { window: 60, max: 100 },
  auth: { window: 60, max: 20 },
  read: { window: 60, max: 300 },
  write: { window: 60, max: 10 },
  strict: { window: 60, max: 5 },
}

export const rateLimit = (category: string = "default") => {
  const limits = CATEGORY_LIMITS[category] ?? CATEGORY_LIMITS.default
  const { window, max } = limits

  return new Elysia({ name: `rate-limit-${category}` }).onRequest(({ request, set }) => {
    const ip = getClientIP(request)
    const path = new URL(request.url).pathname
    const key = `${category}:${ip}:${path}`

    const result = checkRateLimit(key, window, max)

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      set.status = 429
      set.headers["Retry-After"] = String(retryAfter)
      return {
        error: "Too many requests",
        retryAfter,
      }
    }

    // These headers are informational — clients can use them to throttle
    set.headers["X-RateLimit-Limit"] = String(max)
    set.headers["X-RateLimit-Remaining"] = String(result.remaining)
    set.headers["X-RateLimit-Reset"] = String(Math.ceil(result.resetAt / 1000))
  })
}
```

- [ ] **Step 2: Apply tiered rate limits in app.ts**

Edit `lib/api/app.ts` — replace the single `.use(rateLimit(60, 100))` with category-specific limits applied before each route group:

```ts
  // ... after .onError(...) block and before .use(betterAuth) ...

  // Tiered rate limiting — more restrictive first (order matters: first match wins)
  .use(rateLimit("strict"))  // catches contact + community-suggestions
  .use(rateLimit("write"))   // catches comments + performance submit + reports
  .use(rateLimit("auth"))    // catches auth endpoints
  .use(rateLimit("read"))    // catches GET-heavy routes
  .use(rateLimit("default")) // catch-all fallback for unlisted routes
  .use(betterAuth)
```

**IMPORTANT:** Since Elysia `.use()` middleware runs in registration order for ALL routes, we need a different strategy. Each route group needs its own rate limiter instance applied only to those routes. Instead, apply the rate limiter directly to each route group:

Replace the old single `.use(rateLimit(60, 100))` with individual rate limiters applied per route group:

```ts
  // ... after .onError(...) block, before .use(betterAuth) ...

  // Auth routes — strictest
  .use(rateLimit("auth"))
  .use(betterAuth)

  // ... move route registrations to sections, each prefixed with appropriate rate limit ...

  // NOTE: Because Elysia's .use() applies middleware to ALL subsequent routes,
  // we need to use group() to scope each rate limit category:
```

**Better approach — use `group()` to scope rate limits:**

```ts
  .onError(({ code, error, set, request }) => {
    console.error(
      `[API Error] ${code} ${request.url}`,
      error instanceof Error ? error.message : error,
    )
    set.status = code === "NOT_FOUND" ? 404 : 500
    return {
      error: code === "NOT_FOUND" ? "Not found" : "Internal server error",
    }
  })
  // Auth — most restrictive rate limit
  .group("/api", (app) =>
    app
      .use(rateLimit("auth"))
      .use(betterAuth)
      .use(userRoutes)
      .use(profilePhotoRoutes)
  )
  // Read-heavy public routes
  .group("/api", (app) =>
    app
      .use(rateLimit("read"))
      .use(healthRoutes)
      .use(gamesRoutes)
      .use(gameVersionsRoutes)
      .use(gameSyncRoutes)
      .use(gamesListingRoutes)
      .use(hardwareRoutes)
      .use(hardwareStatsRoutes)
      .use(performanceRoutes)
      .use(gameStatsRoutes)
      .use(dashboardRoutes)
      .use(dashboardPublicRoutes)
      .use(playabilityRoutes)
      .use(steamReviewRoutes)
      .use(compareRoutes)
      .use(savedGamesRoutes)
      .use(savedFilterRoutes)
      .use(steamSearchRoutes)
      .use(searchUnifiedRoutes)
      .use(gameStubRoutes)
      .use(steamgridProxyRoutes)
      .use(gamesManualRoutes)
      .use(screenshotRoutes)
  )
  // Write routes
  .group("/api", (app) =>
    app
      .use(rateLimit("write"))
      .use(betterAuth)
      .use(performanceVerifyRoutes)
      .use(performanceSubmitRoutes)
      .use(commentsRoutes)
      .use(reportRoutes)
      .use(adminReportRoutes)
      .use(adminPerformanceRoutes)
      .use(adminCommentRoutes)
      .use(adminStorageRoutes)
  )
  // Strict routes (contact + suggestions)
  .group("/api", (app) =>
    app
      .use(rateLimit("strict"))
      .use(contactRoutes)
      .use(communitySuggestionRoutes)
  )
  // Cron — no rate limit
  .use(cronRoutes)
  // Root — default rate limit
  .use(rateLimit("default"))
  .get("/", () => ({
    name: "DeckyVault API",
    version: "2026.0.101",
  }))
```

**WARNING:** The `betterAuth` middleware must be present in each group that needs auth guards. This is a gotcha — because `group()` scopes middleware, the `betterAuth` from one group doesn't leak to others. Routes in the "read" group using public data don't need it, but "write" and "auth" groups do.

- [ ] **Step 3: Run the existing test suite to verify nothing broke**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault
bun run test
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/rate-limit.ts lib/api/app.ts
git commit -m "feat(security): tiered rate limiting with 5 categories (auth/read/write/strict/default)"
```

---

### Task 1.2: Comment Anti-Spam & Submission Validation Hardening

**Files:**
- Modify: `lib/api/comments.ts`
- Modify: `lib/api/performance-submit.ts`

- [ ] **Step 1: Add duplicate comment detection and content length cap**

Edit `lib/api/comments.ts` — in the `.post("/")` handler, after the `requireRole` guard but before the parent comment check, add:

```ts
      // ── Anti-spam: content length cap ──────────────────────────
      const contentStr = JSON.stringify(body.content)
      if (contentStr.length > 50000) {
        set.status = 413
        return { error: "Comment content exceeds maximum size (50KB)" }
      }

      // ── Anti-spam: duplicate detection ─────────────────────────
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const [duplicate] = await db
        .select({ id: gameComments.id })
        .from(gameComments)
        .where(
          and(
            eq(gameComments.gameId, params.gameId),
            eq(gameComments.userId, guard.user.id),
            eq(gameComments.isRemoved, false),
            sql`${gameComments.createdAt} >= ${fiveMinutesAgo}`,
          ),
        )
        .limit(1)

      if (duplicate) {
        // Check if content is identical to this recent comment
        const [recent] = await db
          .select({ content: gameComments.content })
          .from(gameComments)
          .where(eq(gameComments.id, duplicate.id))
          .limit(1)

        if (recent && JSON.stringify(recent.content) === contentStr) {
          set.status = 409
          return { error: "Duplicate comment detected — you posted identical content in the last 5 minutes" }
        }
      }

      // ── Anti-spam: per-user hourly cap ─────────────────────────
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const [{ count: recentCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameComments)
        .where(
          and(
            eq(gameComments.userId, guard.user.id),
            eq(gameComments.isRemoved, false),
            sql`${gameComments.createdAt} >= ${oneHourAgo}`,
          ),
        )

      if (recentCount >= 30) {
        set.status = 429
        return { error: "Too many comments — you've reached the hourly limit of 30" }
      }
```

The import additions needed at the top of the file:
```ts
import { sql } from "drizzle-orm"
```

(Note: `sql` is likely already imported — verify. The existing imports include `and, desc, sql, isNull` from `drizzle-orm`.)

- [ ] **Step 2: Add input sanitization on comment content**

Still in the `.post("/")` handler, right before the `db.insert`, add a sanitization step:

```ts
      // ── Sanitize: strip <script> tags and javascript: URLs from content ──
      const sanitizeValue = (val: unknown): unknown => {
        if (typeof val === "string") {
          return val
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/javascript\s*:/gi, "blocked:")
        }
        if (Array.isArray(val)) return val.map(sanitizeValue)
        if (val !== null && typeof val === "object") {
          const cleaned: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            cleaned[k] = sanitizeValue(v)
          }
          return cleaned
        }
        return val
      }
      const sanitizedContent = sanitizeValue(body.content) as Record<string, unknown>
```

Then change the `.values()` call to use `content: sanitizedContent` instead of `content: body.content`.

- [ ] **Step 3: Add submission validation hardening**

Edit `lib/api/performance-submit.ts` — in the `.post("/submit")` handler, after the existing field extraction but before the `versionId/!hardwareSlug/!fpsAvg` validation, add:

```ts
      // ── Submission cooldown: 60 seconds between entries per user ──
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000)
      const [lastEntry] = await db
        .select({ createdAt: performanceEntries.createdAt })
        .from(performanceEntries)
        .where(
          and(
            eq(performanceEntries.userId, guard.user.id),
            sql`${performanceEntries.createdAt} >= ${sixtySecondsAgo}`,
          ),
        )
        .orderBy(sql`${performanceEntries.createdAt} DESC`)
        .limit(1)

      if (lastEntry) {
        const retryAfter = Math.ceil(
          (lastEntry.createdAt.getTime() + 60_000 - Date.now()) / 1000
        )
        set.status = 429
        return {
          error: "Please wait before submitting another benchmark",
          retryAfter: Math.max(1, retryAfter),
        }
      }

      // ── Validation: fpsAvg bounds ───────────────────────────────
      if (typeof fpsAvg !== "number" || fpsAvg < 1 || fpsAvg > 500) {
        set.status = 400
        return { error: "fpsAvg must be between 1 and 500" }
      }

      // ── Validation: optional FPS bounds ─────────────────────────
      if (fpsLow !== null && (fpsLow < 0 || fpsLow > 500)) {
        set.status = 400
        return { error: "fpsLow must be between 0 and 500" }
      }
      if (fpsHigh !== null && (fpsHigh < 0 || fpsHigh > 500)) {
        set.status = 400
        return { error: "fpsHigh must be between 0 and 500" }
      }
      if (fpsOnePercentLow !== null && (fpsOnePercentLow < 0 || fpsOnePercentLow > 500)) {
        set.status = 400
        return { error: "fpsOnePercentLow must be between 0 and 500" }
      }

      // ── Validation: tdpWatts bounds ─────────────────────────────
      if (tdpWatts !== null && tdpWatts <= 0) {
        set.status = 400
        return { error: "tdpWatts must be greater than 0" }
      }

      // ── Validation: settingsJson size limits ────────────────────
      if (settingsJson) {
        if (!Array.isArray(settingsJson)) {
          set.status = 400
          return { error: "settingsJson must be an array" }
        }
        if (settingsJson.length > 20) {
          set.status = 400
          return { error: "Maximum 20 settings categories allowed" }
        }
        for (const cat of settingsJson) {
          if (cat.settings && Array.isArray(cat.settings) && cat.settings.length > 50) {
            set.status = 400
            return { error: `Maximum 50 settings per category (exceeded in "${cat.category}")` }
          }
        }
      }

      // ── Validation: userNotes length ────────────────────────────
      if (userNotes && typeof userNotes === "string" && userNotes.length > 5000) {
        set.status = 400
        return { error: "userNotes must be 5000 characters or less" }
      }
```

- [ ] **Step 4: Ensure the sql import exists in performance-submit.ts**

Check the imports at the top of `lib/api/performance-submit.ts`. The `sql` import from `drizzle-orm` should already be present (it's used in the existing code). If missing, add it:
```ts
import { eq, and, sql } from "drizzle-orm"
```

- [ ] **Step 5: Run test suite**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault
bun run test
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/api/comments.ts lib/api/performance-submit.ts
git commit -m "feat(security): comment anti-spam (duplicate detection, length cap, hourly limit) and submission validation hardening"
```

---

## Phase 2: SteamDB Version Auto-Fetch (Stream A)

### Task 2.1: SteamDB Scraper + Cache

**Files:**
- Create: `lib/steamdb/cache.ts`
- Create: `lib/steamdb/scrape.ts`

- [ ] **Step 1: Create the in-memory cache module**

Create `lib/steamdb/cache.ts`:

```ts
interface CachedVersion {
  versionString: string | null
  buildId: string | null
  fetchedAt: number
}

const cache = new Map<number, CachedVersion>()
const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

export function getCachedVersion(steamAppId: number): CachedVersion | null {
  const entry = cache.get(steamAppId)
  if (!entry) return null
  if (Date.now() - entry.fetchedAt > TTL_MS) {
    cache.delete(steamAppId)
    return null
  }
  return entry
}

export function setCachedVersion(
  steamAppId: number,
  versionString: string | null,
  buildId: string | null,
): void {
  cache.set(steamAppId, {
    versionString,
    buildId,
    fetchedAt: Date.now(),
  })
}

// Cooldown tracking for failed fetches
const cooldowns = new Map<number, number>()

export function isOnCooldown(steamAppId: number): boolean {
  const until = cooldowns.get(steamAppId)
  if (!until) return false
  if (Date.now() > until) {
    cooldowns.delete(steamAppId)
    return false
  }
  return true
}

export function setCooldown(steamAppId: number, minutes: number = 30): void {
  cooldowns.set(steamAppId, Date.now() + minutes * 60 * 1000)
}

export function setExtendedCooldown(steamAppId: number): void {
  cooldowns.set(steamAppId, Date.now() + 24 * 60 * 60 * 1000) // 24 hours
}
```

- [ ] **Step 2: Create the SteamDB HTML scraper**

Create `lib/steamdb/scrape.ts`:

```ts
import { getCachedVersion, setCachedVersion, isOnCooldown, setCooldown, setExtendedCooldown } from "./cache"

const STEAMDB_APP_URL = "https://steamdb.info/app"

interface ScrapeResult {
  versionString: string | null
  buildId: string | null
}

export async function scrapeSteamDBVersion(steamAppId: number): Promise<ScrapeResult & { cached: boolean }> {
  // Check cache first
  const cached = getCachedVersion(steamAppId)
  if (cached) {
    return { versionString: cached.versionString, buildId: cached.buildId, cached: true }
  }

  // Check cooldown
  if (isOnCooldown(steamAppId)) {
    // Return stale cache if it exists (beyond TTL but still useful)
    return { versionString: null, buildId: null, cached: true }
  }

  // If scraping is disabled via env, skip
  if (process.env.STEAMDB_SCRAPING_ENABLED === "false") {
    return { versionString: null, buildId: null, cached: true }
  }

  try {
    const res = await fetch(`${STEAMDB_APP_URL}/${steamAppId}/`, {
      headers: {
        "User-Agent": "DeckyVault/1.0 (deckyvault.xyz; game version lookup)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (res.status === 429 || res.status === 403) {
      setExtendedCooldown(steamAppId)
      return { versionString: null, buildId: null, cached: true }
    }

    if (!res.ok) {
      setCooldown(steamAppId, 30)
      return { versionString: null, buildId: null, cached: true }
    }

    const html = await res.text()
    const result = parseSteamDBHtml(html)

    setCachedVersion(steamAppId, result.versionString, result.buildId)
    return { ...result, cached: false }
  } catch {
    setCooldown(steamAppId, 30)
    return { versionString: null, buildId: null, cached: true }
  }
}

function parseSteamDBHtml(html: string): ScrapeResult {
  let versionString: string | null = null
  let buildId: string | null = null

  // Strategy 1: Look for "Last known name" in meta or table rows
  // SteamDB renders data in <tr>/<td> pairs and also JSON-LD
  const lastKnownMatch = html.match(/Last known name[^<]*<[^>]*>([^<]+)</i)
  if (lastKnownMatch) {
    versionString = lastKnownMatch[1].trim()
  }

  // Strategy 2: Try JSON-LD for version
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  if (jsonLdMatch) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1])
      if (parsed.version) {
        versionString = versionString || parsed.version
      }
    } catch {
      // JSON-LD parse failure is non-fatal
    }
  }

  // Strategy 3: Extract build ID from the page
  // Build IDs appear in table rows like: <tr><td>Build ID</td><td>12345678</td></tr>
  const buildMatch = html.match(/Build\s*ID[^<]*<\/td>\s*<td[^>]*>(\d+)/i)
     || html.match(/buildid[^>]*>(\d+)/i)
  if (buildMatch) {
    buildId = buildMatch[1].trim()
  }

  // Strategy 4: Look for patch/update info in "ChangeNumber" or "Last Record Update"
  const changeMatch = html.match(/changenumber[^>]*>(\d+)/i)
  if (changeMatch && !buildId) {
    // ChangeNumber can serve as a proxy for latest version tracking
    // but it's not a build ID per se — only use if buildId is null
  }

  // Strategy 5: Try to find version in the page title or h1
  if (!versionString) {
    const titleMatch = html.match(/<title>([^<]*)· SteamDB<\/title>/)
    if (titleMatch) {
      const titleParts = titleMatch[1].trim()
      // Title format: "Game Name · AppID · SteamDB"
      const appIdMatch = titleParts.match(/·\s*(\d+)\s*·/)
      // Not helpful for version
    }
  }

  return { versionString, buildId }
}
```

- [ ] **Step 3: Write unit tests for the HTML parser**

Create `lib/steamdb/__tests__/scrape.test.ts`:

```ts
import { describe, it, expect } from "vitest"

// Test the parse function directly by importing the private function
// We expose it for testing by re-exporting from the module
// (add this in scrape.ts: export const _parseSteamDBHtml = parseSteamDBHtml)

describe("SteamDB HTML Parser", () => {
  // Since parseSteamDBHtml is not exported, we test scrapeSteamDBVersion
  // indirectly by mocking fetch. But for a proper unit test, let's
  // export the parser.

  it("parses version and build from typical SteamDB HTML", async () => {
    // We'll import the exported parser after adding the export
    const { _parseSteamDBHtml } = await import("../scrape")

    const html = `
      <html>
        <body>
          <table>
            <tr><td>Last known name</td><td>v1.2.3</td></tr>
            <tr><td>Build ID</td><td>12345678</td></tr>
          </table>
        </body>
      </html>
    `

    const result = _parseSteamDBHtml(html)
    expect(result.versionString).toBe("v1.2.3")
    expect(result.buildId).toBe("12345678")
  })

  it("returns nulls for unrecognized HTML", async () => {
    const { _parseSteamDBHtml } = await import("../scrape")
    const result = _parseSteamDBHtml("<html><body>Nothing here</body></html>")
    expect(result.versionString).toBeNull()
    expect(result.buildId).toBeNull()
  })

  it("extracts build ID even without version string", async () => {
    const { _parseSteamDBHtml } = await import("../scrape")
    const html = `
      <tr><td>Build ID</td><td>99999</td></tr>
    `
    const result = _parseSteamDBHtml(html)
    expect(result.buildId).toBe("99999")
    expect(result.versionString).toBeNull()
  })
})
```

**Note:** Add this export in `scrape.ts` for testability:
```ts
// Export for testing
export const _parseSteamDBHtml = parseSteamDBHtml
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault
mkdir -p lib/steamdb/__tests__
bun run test lib/steamdb/__tests__/scrape.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/steamdb/cache.ts lib/steamdb/scrape.ts lib/steamdb/__tests__/scrape.test.ts
git commit -m "feat(steamdb): scraper + cache for SteamDB version auto-fetch"
```

---

### Task 2.2: SteamDB API Endpoint

**Files:**
- Create: `lib/api/steamdb-version.ts`
- Modify: `lib/api/index.ts`
- Modify: `lib/api/app.ts`

- [ ] **Step 1: Create the API endpoint**

Create `lib/api/steamdb-version.ts`:

```ts
import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { scrapeSteamDBVersion } from "@/lib/steamdb/scrape"

export const steamdbVersionRoutes = new Elysia({
  prefix: "/games/:gameId",
  detail: { tags: ["Games"] },
}).get(
  "/steamdb-version",
  async ({ params, set }) => {
    // Look up game's steamAppId
    const [game] = await db
      .select({ steamAppId: games.steamAppId })
      .from(games)
      .where(eq(games.id, params.gameId))
      .limit(1)

    if (!game) {
      set.status = 404
      return { error: "Game not found" }
    }

    if (game.steamAppId === null) {
      return { unavailable: true, reason: "no_steam_app_id" }
    }

    // Check if scraping is globally disabled
    if (process.env.STEAMDB_SCRAPING_ENABLED === "false") {
      return { unavailable: true, reason: "scraping_disabled" }
    }

    const result = await scrapeSteamDBVersion(game.steamAppId)

    if (result.versionString === null && result.buildId === null) {
      return { unavailable: true, reason: "not_found" }
    }

    return {
      versionString: result.versionString,
      buildId: result.buildId,
      steamAppId: game.steamAppId,
      source: "steamdb",
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
  },
)
```

- [ ] **Step 2: Export the route from index.ts**

Edit `lib/api/index.ts` — add the export:

```ts
// Add this line in alphabetical position among other exports:
export { steamdbVersionRoutes } from "./steamdb-version"
```

- [ ] **Step 3: Register the route in app.ts**

Edit `lib/api/app.ts` — add the import and route registration. The endpoint is read-only, so it belongs in the "read" group:

Add the import:
```ts
import { steamdbVersionRoutes } from "@/lib/api/steamdb-version"
```

Then add `.use(steamdbVersionRoutes)` in the read group (alongside `gamesRoutes`, `gameVersionsRoutes`, etc.):

```ts
  // Read-heavy public routes
  .group("/api", (app) =>
    app
      .use(rateLimit("read"))
      .use(healthRoutes)
      .use(gamesRoutes)
      .use(gameVersionsRoutes)
      .use(steamdbVersionRoutes)  // <-- ADD THIS
      .use(gameSyncRoutes)
      // ... rest unchanged
  )
```

- [ ] **Step 4: Verify the endpoint responds**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault
# Start dev server in background
bun run dev &
sleep 5
# Test with a known game (replace with a real gameId from DB)
curl -s http://localhost:3000/api/games/<real-game-id>/steamdb-version | jq
```

Expected: JSON response with `versionString`, `buildId` fields, or `{ unavailable: true }`.

- [ ] **Step 5: Commit**

```bash
git add lib/api/steamdb-version.ts lib/api/index.ts lib/api/app.ts
git commit -m "feat(steamdb): API endpoint GET /api/games/:gameId/steamdb-version"
```

---

### Task 2.3: Integrate SteamDB Version into Submit Wizard

**Files:**
- Modify: `components/wizard/steps/setup-step.tsx`
- Modify: `components/wizard/game-entry-wizard.tsx`

- [ ] **Step 1: Add SteamDB version fetch to the Setup Step**

Edit `components/wizard/steps/setup-step.tsx` — add a new prop and fetch logic for the SteamDB suggestion.

First, add the SteamDB version type and new props to the interface:

```tsx
import { DatabaseIcon, RefreshCwIcon } from "lucide-react"
import { useState, useEffect } from "react"
```

Add to the interface (before the closing `}`):

```tsx
interface SteamDBVersion {
  versionString: string | null
  buildId: string | null
}

interface SetupStepProps {
  // ... existing props ...
  steamdbVersion: SteamDBVersion | null
  steamdbLoading: boolean
  onRefreshSteamDB: () => void
}
```

In the Game Version `<select>` section, add the SteamDB option at the top when data is available:

```tsx
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Version</label>
            <select
              value={selectedVersionId}
              onChange={(e) => onVersionChange(e.target.value)}
              className="w-full appearance-none px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors cursor-pointer"
            >
              {/* SteamDB suggestion — appears at top when available */}
              {steamdbVersion && (steamdbVersion.versionString || steamdbVersion.buildId) && (
                <option value="__steamdb__" className="bg-primary/10 text-primary">
                  ⬇ Latest from SteamDB: {steamdbVersion.versionString || `Build ${steamdbVersion.buildId}`} — recommended
                </option>
              )}
              {steamdbLoading && (
                <option disabled className="text-text/40">
                  Fetching latest version from SteamDB...
                </option>
              )}
              <option disabled className="text-text/30 text-xs">
                ── Existing versions ──
              </option>
              {gameVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versionString
                    ? v.versionString
                    : v.buildId
                    ? `Build ${v.buildId}`
                    : "Unknown version"}
                  {v.isLatest ? " (latest)" : ""}
                </option>
              ))}
              <option value="__new__">
                ＋ New version...
              </option>
            </select>
            {/* Refresh button for SteamDB */}
            <button
              type="button"
              onClick={onRefreshSteamDB}
              disabled={steamdbLoading}
              className="flex items-center gap-1 text-xs text-text/40 hover:text-primary transition-colors cursor-pointer mt-1 disabled:opacity-30"
            >
              <RefreshCwIcon className={`h-3 w-3 ${steamdbLoading ? "animate-spin" : ""}`} />
              Refresh from SteamDB
            </button>
          </div>
```

Also update the `isNewVersion` check to handle the `__steamdb__` value:

```tsx
  const isNewVersion = selectedVersionId === "__new__"
  const isSteamDBVersion = selectedVersionId === "__steamdb__"
```

When `isSteamDBVersion` is true, show the SteamDB data as read-only fields instead of the "new version" text inputs:

```tsx
          {isSteamDBVersion && steamdbVersion && (
            <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-primary">SteamDB Suggestion</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-text/40">Version</p>
                  <p className="text-sm text-text">{steamdbVersion.versionString || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-text/40">Build ID</p>
                  <p className="text-sm text-text font-mono">{steamdbVersion.buildId || "—"}</p>
                </div>
              </div>
              <p className="text-xs text-text/40">
                This version will be created when you submit your benchmark.
              </p>
            </div>
          )}
```

- [ ] **Step 2: Add SteamDB state and fetch logic to the Wizard**

Edit `components/wizard/game-entry-wizard.tsx` — add state for SteamDB data and a fetch function:

Add the import:
```tsx
import { DatabaseIcon } from "lucide-react"
```

Add state:
```tsx
  // SteamDB version suggestion
  const [steamdbVersion, setSteamdbVersion] = useState<{
    versionString: string | null
    buildId: string | null
  } | null>(null)
  const [steamdbLoading, setSteamdbLoading] = useState(false)
```

Add the fetch function:
```tsx
  const fetchSteamDBVersion = useCallback(async () => {
    setSteamdbLoading(true)
    try {
      const res = await fetch(`/api/games/${gameId}/steamdb-version`)
      if (!res.ok) return
      const data = await res.json()
      if (data.versionString || data.buildId) {
        setSteamdbVersion({
          versionString: data.versionString,
          buildId: data.buildId,
        })
      }
    } catch {
      // Silently fail — SteamDB is best-effort
    } finally {
      setSteamdbLoading(false)
    }
  }, [gameId])
```

Add a `useEffect` to fetch on mount:
```tsx
  useEffect(() => {
    fetchSteamDBVersion()
  }, [fetchSteamDBVersion])
```

Pass the new props to `SetupStep`:
```tsx
        <SetupStep
          gameId={gameId}
          gameVersions={gameVersions}
          hardwareSlug={hardwareSlug}
          onHardwareChange={handleHardwareChange}
          hardwareName={hardwareName}
          selectedVersionId={selectedVersionId}
          onVersionChange={setSelectedVersionId}
          newVersionString={newVersionString}
          onNewVersionStringChange={setNewVersionString}
          isCreatingVersion={isCreatingVersion}
          antiCheat={antiCheat}
          onAntiCheatChange={setAntiCheat}
          platformSupport={platformSupport}
          steamdbVersion={steamdbVersion}
          steamdbLoading={steamdbLoading}
          onRefreshSteamDB={fetchSteamDBVersion}
        />
```

Handle the `__steamdb__` version selection in the submit logic — when the user selects the SteamDB option and submits, a new version must be created with the SteamDB data. In the wizard's submit handler (where it POSTs to `/api/performance/submit`), check if `selectedVersionId === "__steamdb__"` and:

1. First create the version via `POST /api/games/{gameId}/versions` with the SteamDB data
2. Use the returned version ID for the performance entry

This requires adding version-creation logic. Let's handle it in the Review step's submission function. The submit already calls the API with `versionId` in the payload. We need to intercept this:

```tsx
  // In the submit handler:
  let effectiveVersionId = selectedVersionId
  
  if (selectedVersionId === "__steamdb__" && steamdbVersion) {
    // Create the version first
    const versionRes = await fetch(`/api/games/${gameId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        versionString: steamdbVersion.versionString,
        buildId: steamdbVersion.buildId,
        isLatest: true,
      }),
      credentials: "include",
    })
    if (!versionRes.ok) {
      setError("Failed to create version from SteamDB suggestion")
      return
    }
    const created = await versionRes.json()
    effectiveVersionId = created.id
  }
```

- [ ] **Step 3: Verify the wizard renders the SteamDB option**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault
bun run dev &
sleep 5
# Visit a game page in the browser, navigate to Submit
# Verify the SteamDB version appears in the version selector (or gracefully shows nothing)
```

Expected: The version selector shows SteamDB option when data is available, falls back gracefully when not.

- [ ] **Step 4: Commit**

```bash
git add components/wizard/steps/setup-step.tsx components/wizard/game-entry-wizard.tsx
git commit -m "feat(steamdb): integrate version auto-fetch into submit wizard version selector"
```

---

## Phase 3: Landing Page (Stream B)

### Task 3.1: Landing Page Sections

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add data fetching and section state to the landing page**

Rewrite `app/page.tsx` — keep the existing hero section, add data sections below. The file is a "use client" component. Add imports and state:

```tsx
"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Gamepad2Icon, SearchIcon, TrendingUpIcon, SparklesIcon, GaugeIcon, FlagIcon } from "lucide-react"
import { useRouter } from "next/navigation"

interface GameCard {
  id: string
  title: string
  capsule_image: string | null
  header_image: string | null
  playability_status?: string | null
  // Section-specific stats:
  activity_score?: number
  benchmark_count?: number
  comment_count?: number
  upvote_count?: number
  avg_fps?: number
  report_count?: number
  release_date?: string | null
  created_at?: string | null
}

interface SectionData {
  trending: GameCard[]
  bestNewReleases: GameCard[]
  mostTested: GameCard[]
  mostReported: GameCard[]
}

export default function Landing() {
    const router = useRouter()
    const words = ["benchmarks", "settings", "reviews"]

    const [currentWord, setCurrentWord] = useState(0)
    const [searchQuery, setSearchQuery] = useState("")

    // Landing section state
    const [sections, setSections] = useState<SectionData>({
      trending: [],
      bestNewReleases: [],
      mostTested: [],
      mostReported: [],
    })
    const [sectionsLoading, setSectionsLoading] = useState(true)

    // Fetch all 4 sections in parallel on mount
    useEffect(() => {
      let cancelled = false
      async function fetchSections() {
        try {
          const [trending, bestNew, mostTested, mostReported] = await Promise.all([
            fetch("/api/dashboard/trending").then(r => r.ok ? r.json() : []),
            fetch("/api/dashboard/best-new-releases").then(r => r.ok ? r.json() : []),
            fetch("/api/dashboard/most-tested").then(r => r.ok ? r.json() : []),
            fetch("/api/dashboard/most-reported").then(r => r.ok ? r.json() : []),
          ])
          if (!cancelled) {
            setSections({
              trending: Array.isArray(trending) ? trending : [],
              bestNewReleases: Array.isArray(bestNew) ? bestNew : [],
              mostTested: Array.isArray(mostTested) ? mostTested : [],
              mostReported: Array.isArray(mostReported) ? mostReported : [],
            })
          }
        } catch {
          // Silently fail — sections are best-effort
        } finally {
          if (!cancelled) setSectionsLoading(false)
        }
      }
      fetchSections()
      return () => { cancelled = true }
    }, [])

    useEffect(() => {
      const interval = setInterval(() => {
        setCurrentWord((prev) => (prev + 1) % words.length)
      }, 2000)
      return () => clearInterval(interval)
    }, [words.length])

    // ... existing handleSearchSubmit and handleKeyDown ...

    return (
      <>
        {/* ── Hero Section (existing, with height adjustment) ── */}
        <section
          id='hero'
          className='w-full min-h-[calc(100svh-10svh)] flex flex-col items-center justify-center relative p-4'
        >
          {/* ... existing hero content unchanged ... */}
        </section>

        {/* ── Landing Sections ── */}
        <div className="w-full max-w-7xl mx-auto px-4 pb-12 space-y-10">
          {sectionsLoading ? (
            <SkeletonSections />
          ) : (
            <>
              {sections.trending.length > 0 && (
                <GameSection
                  title="Trending This Week"
                  icon={TrendingUpIcon}
                  games={sections.trending}
                  statKey="benchmark_count"
                  statLabel="benchmarks this week"
                  accentColor="text-orange-400"
                />
              )}
              {sections.bestNewReleases.length > 0 && (
                <GameSection
                  title="Best Performing New Releases"
                  icon={SparklesIcon}
                  games={sections.bestNewReleases}
                  statKey="avg_fps"
                  statLabel="avg FPS"
                  statFormatter={(v) => `${Math.round(Number(v))} FPS`}
                  accentColor="text-green-400"
                />
              )}
              {sections.mostTested.length > 0 && (
                <GameSection
                  title="Most Tested Games"
                  icon={GaugeIcon}
                  games={sections.mostTested}
                  statKey="benchmark_count"
                  statLabel="benchmarks"
                  accentColor="text-blue-400"
                />
              )}
              {sections.mostReported.length > 0 && (
                <GameSection
                  title="Most Reported Games"
                  icon={FlagIcon}
                  games={sections.mostReported}
                  statKey="report_count"
                  statLabel="open reports"
                  accentColor="text-red-400"
                  muted
                />
              )}
            </>
          )}
        </div>

        {/* ... existing schema.org script ... */}
      </>
    )
}
```

- [ ] **Step 2: Add the GameSection and SkeletonSections components**

Add these components in the same file, below the `Landing` function:

```tsx
function SkeletonSections() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-3">
          <div className="h-5 w-48 bg-text/5 rounded animate-pulse" />
          <div className="flex gap-3 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((j) => (
              <div
                key={j}
                className="shrink-0 w-36 sm:w-44 rounded-xl bg-text/3 border border-border animate-pulse"
              >
                <div className="aspect-[2/3] bg-text/5 rounded-t-xl" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-text/5 rounded w-3/4" />
                  <div className="h-2 bg-text/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function GameSection({
  title,
  icon: Icon,
  games,
  statKey,
  statLabel,
  statFormatter,
  accentColor = "text-text/50",
  muted = false,
}: {
  title: string
  icon: React.ElementType
  games: GameCard[]
  statKey: string
  statLabel: string
  statFormatter?: (v: unknown) => string
  accentColor?: string
  muted?: boolean
}) {
  const router = useRouter()

  const formatStat = (v: unknown): string => {
    if (statFormatter) return statFormatter(v)
    if (typeof v === "number") return `${Math.round(v)} ${statLabel}`
    return `${v} ${statLabel}`
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4 }}
      className={muted ? "opacity-70" : ""}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="border-l-2 border-primary pl-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${accentColor}`} />
            <h2 className="text-sm font-semibold text-text/80">{title}</h2>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
        {games.map((game, idx) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: idx * 0.05 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="group shrink-0 w-36 sm:w-44 rounded-xl bg-text/3 border border-border hover:border-text/30 hover:bg-text/[0.06] transition-colors cursor-pointer overflow-hidden"
            onClick={() => router.push(`/game/${game.id}?sync=1`)}
          >
            {/* Cover image */}
            <div className="relative aspect-[2/3] bg-text/10 overflow-hidden">
              {game.capsule_image ? (
                <Image
                  src={game.capsule_image}
                  alt={game.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 144px, 176px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Gamepad2Icon className="h-8 w-8 text-text/15" />
                </div>
              )}
              {/* Playability badge overlay */}
              {game.playability_status && game.playability_status !== "unknown" && (
                <div className="absolute top-1.5 right-1.5">
                  <PlayabilityDot status={game.playability_status} />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-2.5 space-y-1.5">
              <h3 className="text-xs font-semibold text-text line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                {game.title}
              </h3>
              <p className={`text-[10px] ${accentColor} font-medium`}>
                {formatStat((game as Record<string, unknown>)[statKey])}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  )
}

function PlayabilityDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    great: "bg-green-500",
    playable: "bg-blue-500",
    needs_tweaks: "bg-yellow-500",
    unplayable: "bg-red-500",
  }
  const labels: Record<string, string> = {
    great: "Plays Great",
    playable: "Playable",
    needs_tweaks: "Needs Tweaks",
    unplayable: "Unplayable",
  }
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] || "bg-text/20"}`}
      title={labels[status] || status}
    />
  )
}
```

- [ ] **Step 3: Adjust the hero height**

In the existing hero `<section>` tag, change:
```tsx
className='w-full h-[calc(100vh-3.6rem)] flex flex-col items-center justify-center relative p-4'
```
to:
```tsx
className='w-full min-h-[calc(100svh-10svh)] flex flex-col items-center justify-center relative p-4'
```

Note: `svh` (small viewport height) is used instead of `vh` for mobile browsers that have dynamic toolbars. The `min-h-` ensures the hero is at least this tall but can grow if content overflows. The old `3.6rem` navbar offset is removed because the hero is inside the body flex column (navbar is already accounted for).

- [ ] **Step 4: Add scrollbar styling to globals.css**

Edit `app/globals.css` — add thin scrollbar styling for the horizontal scroll sections:

```css
/* Thin scrollbar for horizontal scroll sections */
.scrollbar-thin {
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--color-text) 15%, transparent) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
    height: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--color-text) 15%, transparent);
    border-radius: 2px;
}
```

- [ ] **Step 5: Build and visually verify**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault
bun run build
```

Expected: No build errors.

Then start the dev server and visit the landing page to verify:
- Hero section is visible with correct height
- Section cards render below
- Cards are clickable and navigate to game pages
- Horizontal scrolling works on the card rows
- The "peek" effect works (bottom of first row visible without scrolling)

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/globals.css
git commit -m "feat(landing): trending, new releases, most tested/reported sections with peek hero layout"
```

---

## Phase 4: Changelog & Version Bump (Stream D)

### Task 4.1: Version Bump, Changelog, and Update News

**Files:**
- Modify: `package.json`
- Modify: `lib/api/app.ts`
- Modify: `CHANGELOG.md`
- Create: `content/updates/2026-05-14-v2026.0.101.md`
- Modify: `lib/api/app.ts` (OpenAPI version)

- [ ] **Step 1: Bump version in package.json**

Edit `package.json` — change:
```json
"version": "2026.0.100",
```
to:
```json
"version": "2026.0.101",
```

- [ ] **Step 2: Bump OpenAPI version in app.ts**

Edit `lib/api/app.ts` — find the OpenAPI info block and change:
```ts
version: "2026.0.100",
```
to:
```ts
version: "2026.0.101",
```

Also update the root `GET /` handler:
```ts
version: "2026.0.9",
```
to:
```ts
version: "2026.0.101",
```

- [ ] **Step 3: Update CHANGELOG.md**

Edit `CHANGELOG.md` — prepend a new entry after the header line:

```markdown
## [2026.0.101] - 2026-05-14

### Added
- SteamDB version auto-fetch — latest game version/build surfaced in submit wizard version selector
- Landing page: Trending This Week, Best Performing New Releases, Most Tested, and Most Reported sections
- Tiered API rate limiting with 5 categories (auth, read, write, strict, default)
- Comment anti-spam: duplicate detection, 50KB content cap, 30/hr per-user limit
- Submission cooldown: 60-second minimum between benchmark entries per user
- Submission validation hardening: FPS bounds (1-500), TDP bounds, settings size caps, userNotes length cap

### Changed
- Landing hero height adjusted to `calc(100svh - 10svh)` for content "peek" effect
- Rate limiter now uses named categories instead of a single global bucket

### Security
- Hardened validation on performance entry submission (fps bounds, settings size caps)
- Server-side sanitization of comment content before storage
- Per-route rate limiting categories for granular abuse prevention
```

- [ ] **Step 4: Create update news markdown**

Create `content/updates/2026-05-14-v2026.0.101.md`:

```markdown
---
title: "Landing Page, SteamDB Version Sync, and Security Hardening"
date: "2026-05-14"
version: "2026.0.101"
summary: "Discover trending games on the new landing page, auto-fetch latest game versions from SteamDB, and enjoy improved API security."
---

### New Landing Page

The homepage now showcases what's happening in the DeckyVault community:

- **Trending This Week** — games with the most benchmarks, comments, and upvotes in the last 7 days
- **Best Performing New Releases** — recently added games with the highest average FPS
- **Most Tested Games** — the most benchmarked games across all devices
- **Most Reported Games** — games with active reports (sunlight as disinfectant!)

Each section shows compact game cards with cover art, playability status, and relevant stats. Click any card to jump straight to the game's detail page.

### SteamDB Version Auto-Fetch

When submitting a benchmark, the wizard now automatically checks SteamDB for the latest game version and build ID. If found, it appears as a recommended option at the top of the version selector — no more guessing which version you're on.

This feature is best-effort and can be disabled via the `STEAMDB_SCRAPING_ENABLED` environment variable.

### API Security Hardening

We've tightened up the API with several layers of protection:

- **Tiered rate limiting** — different limits for authentication, reads, writes, and public forms
- **Comment anti-spam** — duplicate detection, size limits, and hourly caps
- **Submission validation** — FPS must be within realistic bounds, settings payloads have size caps
- **Content sanitization** — comment content is cleaned server-side before storage
```

- [ ] **Step 5: Verify all version references are consistent**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault
grep -r "2026.0.100\|2026.0.101" package.json lib/api/app.ts CHANGELOG.md content/updates/2026-05-14-v2026.0.101.md
```

Expected: Only `2026.0.101` appears (no stale `2026.0.100` references remaining).

- [ ] **Step 6: Run full test suite**

```bash
bun run test
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add package.json lib/api/app.ts CHANGELOG.md content/updates/2026-05-14-v2026.0.101.md
git commit -m "chore: bump version to 2026.0.101, update changelog and update news"
```

---

## Verification Checklist (Post-Implementation)

Run these after all phases are complete:

- [ ] `bun run test` — all tests pass
- [ ] `bun run build` — no build errors
- [ ] `bun run dev` — landing page loads, sections render, cards are clickable
- [ ] Submit wizard — SteamDB version appears when available, version selector works
- [ ] Comment posting — duplicate detection rejects identical comments within 5 minutes
- [ ] API rate limit — hitting an endpoint repeatedly returns 429
- [ ] `grep -r "2026.0.100" package.json lib/api/app.ts` returns nothing

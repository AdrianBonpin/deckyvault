# Architectural Spec: Sitemap Remediation, PWA Activation & Search Refinements

**Date:** 2026-05-05
**Status:** Final — Awaiting Tactical Planning
**Author:** Autonomous Architect
**Depends On:** `docs/2025-05-05-sync-pwa-architectural-spec.md` (existing PWA constraints — extended, not replaced)

---

## 1. Problem Statement

Three objectives converge on site reliability and user experience for the primary audience: Steam Deck handheld users. The sitemap is a critical SEO signal that is currently failing silently; the PWA foundation exists as a manifest but lacks the service-worker layer that enables offline use; the advanced search/filter system shipped in v2026.0.95 needs hardening for edge cases and Steam Deck touch ergonomics.

---

## 2. Objective 1 — Sitemap Remediation

### 2.1 Observed Symptoms

| Symptom | Evidence |
|---|---|
| Google Search Console reports sitemap unreadable | User report — no indexed games despite manual load working |
| Sitemap loads at `https://deckyvault.xyz/sitemap.xml` but shows no games | User report — confirmed manually |
| No Google indexing for game pages | Implied by Search Console failure |

### 2.2 Root Cause Analysis

A comparison against a known-working reference sitemap (Next.js 15 + Drizzle + PostgreSQL, same stack) reveals **two structural anti-patterns** and one SQL semantics bug that together explain the symptoms.

#### Root Cause A: ISR Caching with `revalidate = 3600` (PRIMARY CAUSE)

```typescript
// app/sitemap.ts — CURRENT (broken)
export const revalidate = 3600
export default async function sitemap() { ... }
```

The sitemap uses ISR (Incremental Static Regeneration) with a 1-hour revalidation window. This is fundamentally wrong for sitemaps because:

1. **Cache poisoning**: If ANY generation event produces an empty or incomplete sitemap (cold start, DB hiccup, deployment restart), that broken response is cached and served to ALL consumers — including Googlebot — for up to an hour.
2. **No diagnostic signal**: There is no way to know what Googlebot received. You manually visit and see a populated sitemap, but Google may have hit the cache during a poisoned window.
3. **Anti-pattern**: ISR is designed for content pages that are expensive to compute and tolerate staleness. A sitemap is a machine-readable inventory that MUST be authoritative at the moment Googlebot reads it.

**The reference project** (same stack, works correctly) uses:
```typescript
export const dynamic = "force-dynamic"
```

This tells Next.js to never cache the route. Every request generates a fresh sitemap from live DB queries. No cache poisoning possible.

**Compounding factor**: `SITEMAP_REVALIDATE_SECONDS` is defined in `.env.example` but **never read** by `app/sitemap.ts`. The revalidation interval is hardcoded to 3600. There is no way to tune this even if ISR were appropriate.

#### Root Cause B: Silent Error Suppression in `fetchGameEntries()`

```typescript
// lib/sitemap/fetch-dynamic-entries.ts (lines 10-28)
async function fetchGameEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const rows = await db.select(...).from(games).where(ne(games.syncStatus, "failed")).limit(MAX_GAME_ENTRIES)
    return rows.map(...)
  } catch {
    return []  // ← SILENTLY RETURNS EMPTY ARRAY ON ANY DB ERROR
  }
}
```

If the PostgreSQL connection times out, is exhausted, or throws any error, the game entries array is silently emptied. Combined with ISR caching (Root Cause A), this one-two punch means: DB hiccup → empty response → cache it for 1 hour → Googlebot reads empty sitemap → zero games indexed.

**The reference project** does not wrap its DB queries in try/catch — it lets errors propagate naturally, which at least returns HTTP 500, prompting Googlebot to retry later rather than consuming a false empty sitemap.

**Trigger conditions:**
- Cold start with connection pool not yet warmed up
- Deployment restart during Googlebot's crawl window
- Connection pool exhaustion from concurrent requests
- PostgreSQL maintenance window or brief outage

#### Root Cause C: NULL `syncStatus` Exclusion (SQL Semantics Bug)

```typescript
.where(ne(games.syncStatus, "failed"))
```

`ne(column, "failed")` generates `"sync_status" <> 'failed'`, which in PostgreSQL returns `NULL` (not `TRUE`) when the column is `NULL`. Rows with NULL `syncStatus` are silently excluded from the sitemap — even when ISR caching is bypassed and the DB query succeeds.

**Impact**: Any game where `syncStatus IS NULL` is invisible to crawlers. This could happen if:
- The column default was added after initial data insertion
- A direct DB manipulation bypassed the application layer
- A migration introduced the column without backfilling existing rows

**Verification query** (run against production DB):
```sql
SELECT COUNT(*) FROM games WHERE sync_status IS NULL;
```

#### Root Cause D: Cloudflare / CDN Cache Interference (Secondary)

If Cloudflare sits in front of the origin, it may independently cache the sitemap XML response. Even with `force-dynamic` at the origin, a Cloudflare Cache Rule with non-zero TTL on `*.xml` would serve a stale copy to Googlebot.

**Verification**: Check Cloudflare dashboard for cached `/sitemap.xml` status and any Page Rules or Cache Rules matching `*.xml`.

### 2.3 Mandatory Fixes

#### Fix 1: Replace ISR with `force-dynamic` (CRITICAL — ONE LINE CHANGE)

**Constraint**: `app/sitemap.ts` MUST use `export const dynamic = "force-dynamic"` instead of `export const revalidate = 3600`. No caching whatsoever. Every request generates a fresh, authoritative sitemap.

**Before:**
```typescript
export const revalidate = 3600
```

**After:**
```typescript
export const dynamic = "force-dynamic"
```

This matches the proven reference pattern. The sitemap is lightweight enough (DB query + JSON serialization of ~50K rows) that per-request generation is acceptable. If this becomes a performance concern at scale (>100K games), the correct approach is a sitemap index with paginated child sitemaps — not ISR caching.

**Note**: The `SITEMAP_REVALIDATE_SECONDS` env var becomes unused and should be cleaned up (or left for future sitemap-index implementation).

#### Fix 2: Remove Silent Error Suppression

**Constraint**: `fetchGameEntries()` and `fetchDeviceEntries()` MUST NOT silently return empty arrays on failure. Errors must propagate so they're observable.

**Design**: Remove the `try/catch` wrappers from both functions. Let DB errors surface naturally. The sitemap route will return HTTP 500 on DB failure, which is the correct behavior — Googlebot retries on 5xx and the error is logged in Vercel/Cloudflare observability.

If partial resilience is desired (static entries even when DB is down), implement it at the `app/sitemap.ts` level with explicit structured logging:

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = buildStaticEntries()
  try {
    const { gameEntries, deviceEntries } = await fetchDynamicEntries()
    console.info("[Sitemap] Generated", { games: gameEntries.length, devices: deviceEntries.length })
    return [...staticEntries, ...gameEntries, ...deviceEntries]
  } catch (err) {
    console.error("[Sitemap] DB query failed, returning static entries only", err)
    return staticEntries
  }
}
```

This way a DB failure still returns a partial sitemap (not 500), but the error is logged with full context rather than silently swallowed.

#### Fix 3: Handle NULL `syncStatus` Explicitly

**Constraint**: The sitemap query MUST include rows where `syncStatus IS NULL`. Use an explicit `OR` condition.

```sql
-- Current (buggy):     WHERE "sync_status" <> 'failed'
-- Correct:             WHERE ("sync_status" <> 'failed' OR "sync_status" IS NULL)
```

In Drizzle:
```typescript
import { or, ne, isNull } from "drizzle-orm"
// ...
.where(or(ne(games.syncStatus, "failed"), isNull(games.syncStatus)))
```

#### Fix 4: Add Structured Logging for Monitoring

**Constraint**: The sitemap generator MUST log a structured metrics object on each successful generation so operations can monitor sitemap health over time.

```typescript
console.info(JSON.stringify({
  event: "sitemap_generated",
  gameCount: gameEntries.length,
  deviceCount: deviceEntries.length,
  staticCount: staticEntries.length,
  totalUrls: staticEntries.length + gameEntries.length + deviceEntries.length,
  generatedAt: new Date().toISOString(),
}))
```

This integrates with existing observability (Vercel logs, Cloudflare Logpush, or a logging drain) without requiring custom HTTP headers.

#### Fix 5: Cloudflare Cache Rule Audit

**Constraint**: If Cloudflare is in use, verify there is NO cache rule matching `/sitemap.xml` with a non-zero TTL. The sitemap must be fetched fresh from origin on every request.

- Check: Page Rules, Cache Rules, and Transform Rules
- Verify: `Content-Type` is not being transformed (must remain `application/xml`)
- Verify: Cloudflare's "Always Online" feature is not serving a stale copy from its own cache

### 2.4 Architecture: Flattened Sitemap Design

Following the reference pattern, the sitemap generator should be restructured as a single flat function in `app/sitemap.ts` rather than delegating to separate files with independent error handling.

**Design principles** (derived from reference):

1. **Single responsibility**: `app/sitemap.ts` owns the entire sitemap generation — DB queries, mapping, and error handling. No delegation to helper files that can fail independently.
2. **Explicit inclusion filter**: Instead of `WHERE syncStatus <> 'failed'` (exclusion), use a positive inclusion filter like `WHERE syncStatus IN ('pending', 'synced')` or omit the filter entirely and let all games appear. The reference project uses `eq(status, 'published')` — a positive assertion of what SHOULD be included.
3. **Inline mapping**: Game rows are mapped to sitemap entries directly in the sitemap function, not in a separate module. This keeps the transformation logic visible and testable in one place.
4. **No premature optimization**: Don't add limits, pagination, or caching until measurements prove they're needed. The reference project queries all matching rows without LIMIT and without caching.

**Recommended structure:**

```typescript
// app/sitemap.ts
export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://deckyvault.xyz"
  const staticEntries = [/* inline static pages */]

  try {
    const gameRows = await db.select({ id: games.id, updatedAt: games.updatedAt }).from(games)
    const gameEntries = gameRows.map((g) => ({
      url: `${baseUrl}/game/${g.id}`,
      lastModified: g.updatedAt ?? new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

    console.info(JSON.stringify({
      event: "sitemap_generated", games: gameEntries.length, generatedAt: new Date().toISOString()
    }))
    return [...staticEntries, ...gameEntries]
  } catch (err) {
    console.error(JSON.stringify({ event: "sitemap_db_error", error: String(err) }))
    return staticEntries
  }
}
```

### 2.5 Sitemap Security & Rate Limiting

- **No auth required**: Sitemap is public by design
- **No rate limiting on sitemap endpoint**: Crawlers must access it freely
- **DB query cost**: With `force-dynamic`, the sitemap hits the DB on every request. A `SELECT id, updated_at FROM games` with ~50K rows is sub-millisecond on modern PostgreSQL. If this becomes measurable, add a materialized view or a `WHERE` clause on an indexed status column.

---

## 3. Objective 2 — PWA & Steam Deck UX

### 3.1 Current State Baseline

| Feature | Status | Location |
|---|---|---|
| Web manifest (`manifest.json`) | ✅ Present | `app/manifest.ts` — `display: "standalone"`, theme color `#eb3779`, bg `#100b14` |
| Service Worker | ❌ Missing | No SW file exists |
| Offline fallback | ❌ Missing | No offline UI |
| Touch targets (44×44px WCAG) | ⚠️ Partial | Game cards use full-card `Link` wrapping ✅; filter chips and select inputs are undersized ❌ |
| Gamepad navigation | ❌ Missing | No Gamepad API integration |
| `viewport-fit=cover` | ❌ Missing | `layout.tsx` uses `overscroll-none` class but no `viewport` meta |
| App icon | ⚠️ Partial | `icon.png` exists but manifest declares `"any"` size — should declare explicit 192px and 512px maskable icons |
| Offline caching strategy | ❌ Missing | No cache-first or stale-while-revalidate strategy |

### 3.2 PWA Architecture Constraints

These extend the existing PWA spec at `docs/2025-05-05-sync-pwa-architectural-spec.md` §5. The original decisions remain binding unless explicitly overridden here.

#### 3.2.1 Service Worker Generation

**Constraint**: Use `@serwist/next` (v9+) — NOT `next-pwa` (unmaintained). `@serwist/next` is the successor maintained by the same community and supports Next.js 15/16 App Router with Turbopack.

**Why `@serwist/next` over alternatives:**
- `next-pwa`: Unmaintained since 2023; broken on Next.js 14+
- `workbox-webpack-plugin`: Requires manual webpack config injection; doesn't work with Turbopack
- `@serwist/next`: Actively maintained, supports App Router, generates SW with TypeScript types, compatible with Next.js `instrumentation.ts` hook

**SW Caching Strategy:**

| Resource Type | Strategy | TTL | Rationale |
|---|---|---|---|
| App shell (HTML layout, CSS, fonts) | **Precache** | N/A (cache-first after install) | Must load instantly offline |
| Game detail pages (`/game/:id`) | **Stale-while-revalidate** | 24h | Show cached content immediately, refresh in background |
| Game listing pages (`/games`) | **Network-first** | 5min | Filters change results; stale data is misleading |
| Images (Steam CDN, SteamGridDB) | **Cache-first** | 30 days | Images rarely change; huge bandwidth savings |
| API responses (`/api/games/*`) | **Network-first** | N/A | Live data is critical for benchmarks |
| Static assets (`/_next/static/*`) | **Precache** | N/A (immutable hashes) | Standard Next.js behavior |

#### 3.2.2 Offline Fallback UI

**Constraint**: An `offline.html` page MUST be served for navigation requests when the network is unavailable and the requested page isn't cached. This is a static page in `public/offline.html` that displays:
- DeckyVault branding
- "You're offline" message
- List of previously viewed games (from SW cache metadata)
- "Go back" button (uses `history.back()`)

**Design**: The SW intercepts all navigation requests. If the network is unavailable and the page isn't in cache, respond with `offline.html` instead of the browser's default offline dinosaur. This provides a branded experience consistent with the installed PWA feel.

#### 3.2.3 Touch Targets

**Constraint**: All interactive elements in the `/games` filter panel, the `/search` results, and the game detail page MUST meet a **minimum 44×44px touch target**. This is WCAG 2.1 AA Level.

**Affected components:**

| Component | Current State | Required Fix |
|---|---|---|
| Filter chips (genre, device) | ~28px height | Increase to 44px with `min-h-[44px]` |
| Select dropdowns (sort, proton, anti-cheat) | ~34px | Increase to 44px |
| Checkbox labels (FSR, free, multiplayer) | Standard text | Add `py-2` for 44px vertical target |
| Search input | ~36px | Increase to 44px |
| Number inputs (min/max FPS, review %) | ~28px | Increase to 44px |
| "Clear all filters" text link | ~16px | Increase to 44px clickable area |
| Navbar links | Varies | Ensure 44px tap area with padding |

**Implementation approach**: Apply touch-optimized sizing via a CSS class `.touch-target` that sets `min-h-[44px] min-w-[44px]`. Use media queries **NOT** to restrict these to touch devices (impossible to detect reliably), but to apply them universally. The visual density trade-off is acceptable given the primary audience is handheld device users.

#### 3.2.4 Gamepad Navigation

**Constraint**: Use the Gamepad API with the following mapping:

| Input | Action | Scope |
|---|---|---|
| D-pad / Left Stick | Move focus between focusable elements (roving tabindex) | Global |
| A button (index 0) | Activate focused element (`click()`) | Global |
| B button (index 1) | Browser back (`history.back()`) | Global |
| X button (index 2) | Open search (`/search`) | Global |
| Y button (index 3) | Toggle filters panel (on `/games`) | Context-aware |
| L1 bumper (index 4) | Previous tab (on game detail page) | Context-aware |
| R1 bumper (index 5) | Next tab (on game detail page) | Context-aware |

**Activation rules:**
- Gamepad mode activates **only on first gamepad input detected** (any button press or axis movement beyond deadzone)
- Gamepad mode deactivates on any mouse movement or keyboard input
- While active, a subtle indicator (small icon in corner) shows gamepad mode is active
- Focus ring uses a custom CSS class `.gamepad-focus` (distinct from `:focus-visible`) — this prevents showing gamepad-style focus rings to mouse users
- All focusable elements get `tabindex="-1"` when gamepad mode is active, except the currently focused one which gets `tabindex="0"` (roving tabindex pattern)

**Dead zone**: Apply 0.15 deadzone to analog stick axes to prevent drift-induced focus movement.

**Implementation boundary**: A single custom hook `useGamepadNavigation(containerRef)` exported from `lib/hooks/use-gamepad-navigation.ts`. This hook manages all Gamepad API lifecycle, focus management, and activation detection. Individual pages consume it via a wrapper component.

#### 3.2.5 Viewport and PWA Meta Tags

**Constraint**: `app/layout.tsx` MUST include a `<meta name="viewport">` tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
```
- `viewport-fit=cover`: Extends content into the notch/safe areas on modern devices
- `maximum-scale=1, user-scalable=no`: Prevents accidental zoom on double-tap during gameplay on Steam Deck touchscreen

**Additional required meta tags:**
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="theme-color" content="#eb3779" />
```

**Manifest icon update:** `app/manifest.ts` must declare explicit sizes:
```json
"icons": [
  { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
  { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
]
```

### 3.3 PWA Security Constraints

- **Service Worker MUST NOT cache**:
  - `/manage/*` (admin dashboard)
  - `/profile/*` (authenticated user data)
  - `/api/auth/*` (authentication endpoints)
  - Any API response containing a `Set-Cookie` header
  - POST, PATCH, DELETE, PUT API responses
- **Service Worker scope**: `/` (root) — standard PWA scope
- **CSP considerations**: The SW must not break Content-Security-Policy headers. Test with strict CSP.
- **HSTS**: Ensure HSTS headers are set at the reverse proxy/Cloudflare level to enforce HTTPS for SW registration (SW requires HTTPS).

---

## 4. Objective 3 — Advanced Search & Filtering

### 4.1 State Assessment

Per CHANGELOG v2026.0.95, the advanced search and filtering system was shipped. The following audit identifies gaps that require attention.

### 4.2 Implemented Features (Verification)

| Feature | Implementation | File | Verified |
|---|---|---|---|
| FPS range (min/max) | Query param → DB subquery | `lib/api/games-listing.ts` | ✅ |
| Device filter | Subquery on `gamePlatformSupport` + `performanceEntries` | `lib/api/games-listing.ts` | ✅ |
| FSR support filter | Subquery on `performanceEntries.upscalerType = 'fsr'` | `lib/api/games-listing.ts` | ✅ |
| Proton/Native filter | Subquery on `gamePlatformSupport.protonStatus` | `lib/api/games-listing.ts` | ✅ |
| Anti-cheat filter | Subquery on `gamePlatformSupport.antiCheatStatus` | `lib/api/games-listing.ts` | ✅ |
| Playability filter | Direct `WHERE` on `games.playabilityStatus` | `lib/api/games-listing.ts` | ✅ |
| Steam review min % | Direct `WHERE gte(games.steamReviewScore)` | `lib/api/games-listing.ts` | ✅ |
| Free-to-play filter | Direct `WHERE eq(games.isFree, true)` | `lib/api/games-listing.ts` | ✅ |
| Multiplayer filter | Direct `WHERE` on `onlineMultiplayerStatus` | `lib/api/games-listing.ts` | ✅ |
| Saved/bookmarked filters | CRUD API + `SavedFilters` component | `lib/api/saved-filters.ts` + `components/saved-filters.tsx` | ✅ |
| Sort: Recent, Name, Benchmarks, Performance, Popularity, Release Date, Steam Reviews | 7 sort dimensions | `games-page-client.tsx` + `games-listing.ts` | ✅ |
| Infinite scroll with IntersectionObserver | Client-side | `games-page-client.tsx` | ✅ |
| Genre multi-select | Client-side filter chips | `games-page-client.tsx` | ✅ |

### 4.3 Gaps & Refinements

#### Gap 1: Genre Multi-Select Limited to Single Genre

**Current behavior**: `games-listing.ts` only accepts a single `genre` parameter (`query.genre`). The client-side UI allows selecting multiple genres, but `buildUrl` only sends the first one:

```typescript
// games-page-client.tsx (lines ~108)
if (selectedGenres.length === 1) params.set("genre", selectedGenres[0])
```

**Impact**: Selecting multiple genres in the filter panel silently ignores all but the first. The user sees 2+ active genre chips but only gets results for one.

**Fix**: The API must support a comma-separated genre list (or repeated `genre` params) and use `OR` logic:

```sql
-- Current: WHERE genres @> '["Action"]'::jsonb
-- Needed:  WHERE genres @> '["Action"]'::jsonb OR genres @> '["RPG"]'::jsonb
```

**Constraint**: Genre multi-select uses **OR** logic (game matches ANY selected genre), not AND (game must match ALL). This is the standard UX pattern for discovery filters.

#### Gap 2: Search/Title Search on `/games` Doesn't Use Fuzzy Matching

**Current behavior**: The `/games` page search uses `ilike(games.title, titleTerm)` where `titleTerm = fuzzySearchTerm(search)`. The fuzzy helper converts spaces to `%` wildcards for multi-word matching but doesn't handle typos.

**Constraint**: This is acceptable for a filter page (users know what they're looking for). The dedicated `/search` page (`search-unified.ts`) handles broader discovery including Steam API fallback. No change required.

#### Gap 3: FPS Filter Performance

**Current behavior**: FPS range filter uses a subquery:
```sql
WHERE games.id IN (SELECT gv.game_id FROM performance_entries pe JOIN game_versions gv ON pe.version_id = gv.id WHERE pe.fps_avg BETWEEN min AND max GROUP BY gv.game_id)
```

This scans `performance_entries` without device filtering. A game with a 60fps benchmark on a high-end desktop (but 15fps on Steam Deck) would pass the FPS filter, misleading Deck users.

**Constraint**: When a device filter is active concurrently with FPS range, the FPS subquery MUST scope to that device:

```sql
WHERE pe.hardware_slug = '<device>' AND pe.fps_avg BETWEEN min AND max
```

When no device filter is active, the current behavior (any device) is acceptable as a coarse filter.

#### Gap 4: No Search Within Results

**Current behavior**: Search and filters operate independently. There's no way to "search within filtered results" — the search text always searches the full games table.

**Constraint**: This is acceptable for the current scope. The search bar + filter panel on `/games` provides sufficient narrowing. Adding "search within results" would require combining text search conditions with all filter subquery conditions, which is a query complexity concern. Mark as a future enhancement.

#### Gap 5: Saved Filters — No Visual Feedback on Load

**Current behavior**: When loading a saved filter, the filter state updates but there's no visual confirmation (toast, animation, or active state on the loaded filter pill).

**Constraint**: Add a brief highlight animation to the loaded filter pill and auto-collapse the filter panel after load. This provides immediate visual feedback that the action succeeded.

#### Gap 6: Missing "Search Intent" URL Parameter Tracking

**Current behavior**: Filter state is purely client-side. Refreshing the `/games` page resets all filters. The URL never reflects active filters (no query params in the address bar).

**Impact**: Users can't share filtered views or bookmark specific filter combinations (beyond the saved-filters feature which requires auth).

**Constraint**: Filter state SHOULD be reflected in the URL as query parameters. This enables:
- Sharing filtered views via link
- Browser back/forward through filter changes
- Bookmarking filtered views without auth
- Better analytics tracking

**Implementation approach**: Use `nuqs` or manual `useSearchParams` + `router.replace` to sync filter state to URL.

---

## 5. Objective 4 — Changelog

### 5.1 Changelog Procedure

**Constraint**: The CHANGELOG.md follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format. Each version entry uses:
- `## [version] - YYYY-MM-DD`
- `### Added`, `### Changed`, `### Fixed`, `### Technical` subsections

**Pending entries for next version (v2026.0.97):**

Based on the work scoped in this spec, the following entries should be appended:

```
## [2026.0.97] - 2026-05-XX

### Fixed
- Sitemap.xml used ISR caching (`revalidate = 3600`) which poisoned the cache with empty responses on DB hiccups; switched to `force-dynamic` for per-request fresh generation
- DB errors during sitemap generation were silently caught and returned as empty arrays (no games indexed); errors now propagate to observability with structured logging
- Games with NULL `syncStatus` were excluded from sitemap due to SQL `<> 'failed'` returning NULL (not TRUE) for NULL values
- Multi-genre selection in games filter panel only applied the first selected genre; now supports comma-separated OR-matching
- FPS range filter included results from non-Steam-Deck devices; now scoped to active device filter when present

### Added
- PWA service worker with offline caching for game pages and images (stale-while-revalidate for HTML, cache-first for Steam CDN images)
- Offline fallback page (`offline.html`) when navigating without network
- Gamepad navigation support (D-pad/left stick focus, A/B/X/Y buttons, L1/R1 tab switching)
- Structured logging for sitemap generation metrics (games count, timestamps) via `console.info` JSON
- Filter state synchronized to URL query parameters for shareable/bookmarkable filtered views

### Changed
- All interactive elements on `/games` and `/search` pages now meet 44×44px minimum touch targets (WCAG 2.1 AA)
- Web manifest icons now declare explicit 192px (maskable) and 512px (any) sizes
- Viewport meta tag added with `viewport-fit=cover` and `user-scalable=no` for installed PWA feel
- Loading a saved filter now highlights the filter pill and collapses the panel for visual feedback
- Sitemap generation flattened into a single function in `app/sitemap.ts` (removed delegation to `lib/sitemap/`)
```

### 5.2 Version Bump

**Constraint**: The version in `package.json` (`"version": "2026.0.96"`) must be bumped to `"2026.0.97"` when any of the above work is shipped. The changelog date `2026-05-XX` must be replaced with the actual release date.

---

## 6. Architecture Boundaries — Cross-Cutting

### 6.1 Performance Budget

| Metric | Budget | Rationale |
|---|---|---|
| Service Worker size | < 50KB (compressed) | Large SW delays registration and first paint |
| Offline page size | < 10KB (total, including inline CSS) | Must load instantly on slow connections |
| Gamepad hook bundle impact | < 3KB (gzipped) | Added to every page that imports it |
| Sitemap generation time | < 5s (p95) | Prevents request timeout during Googlebot crawl |
| Sitemap response size | < 50MB (uncompressed) or 50,000 URLs | Google's sitemap limit. Beyond this, use sitemap index |

### 6.2 Dependency Additions

| Package | Purpose | Version Constraint |
|---|---|---|
| `@serwist/next` | Service worker generation for Next.js App Router | `^9.0.0` |
| `@serwist/precaching` | Precaching utilities | `^9.0.0` (peer) |
| `@serwist/sw` | Service worker runtime | `^9.0.0` (peer) |
| `nuqs` | URL query state management (optional, alternative to manual `useSearchParams`) | `^2.0.0` |

**No other new dependencies are required.** Gamepad API is browser-native. Touch targets are CSS-only. Sitemap fixes are logic changes to existing code.

### 6.3 Files Affected (Summary)

| File | Change Type | Objective |
|---|---|---|
| `app/sitemap.ts` | **Rewrite** — flatten to single function, `force-dynamic`, inline DB queries, structured logging, NULL-safe filter | Sitemap |
| `lib/sitemap/fetch-dynamic-entries.ts` | **Mark deprecated** (or delete if no other consumers) — logic moves into `app/sitemap.ts` | Sitemap |
| `lib/api/games-listing.ts` | Modify — multi-genre support, device-scoped FPS filter | Search |
| `app/games/games-page-client.tsx` | Modify — multi-genre URL params, touch targets, URL sync | Search + PWA |
| `app/manifest.ts` | Modify — explicit icon sizes (192px maskable, 512px any) | PWA |
| `app/layout.tsx` | Modify — viewport meta, PWA meta tags (`apple-mobile-web-app-capable`, `theme-color`) | PWA |
| `components/saved-filters.tsx` | Modify — load highlight animation, auto-collapse panel | Search |
| `public/offline.html` | **Create** — offline fallback page with branding + previously-viewed games list | PWA |
| `lib/hooks/use-gamepad-navigation.ts` | **Create** — Gamepad API hook with activation detection, roving tabindex, focus ring | PWA |
| `instrumentation.ts` or `app/sw.ts` | **Create** — Service worker entry point (via @serwist/next) | PWA |
| `CHANGELOG.md` | Modify — append v2026.0.97 entries | Changelog |
| `package.json` | Modify — version bump to 2026.0.97, add @serwist deps | Changelog + PWA |

### 6.4 Files NOT Affected
- `lib/steam/sync.ts` — No changes (sync unification was completed in previous spec)
- `lib/db/schema/*` — No schema changes
- `app/api/*` — No API route changes beyond games-listing
- `components/navbar.tsx` — No layout changes
- `app/search/page.tsx` — Search page uses unified search API, already complete

---

## 7. Risk Register

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| R1 | `@serwist/next` incompatible with Next.js 16 + Turbopack | Medium | High (PWA blocked entirely) | Verify compatibility in a branch before full implementation. Fallback: manual `workbox-build` integration as a `postbuild` script. |
| R2 | Service worker caches stale game data shown to users | Medium | Medium | Stale-while-revalidate with 24h max TTL. Service worker update flow triggers refresh on new version detection. |
| R3 | Gamepad API unavailable on some Steam Deck firmware versions | Low | Medium | Feature-detect `navigator.getGamepads`. Degrade silently with no gamepad functionality. SteamOS 3.5+ ships Chromium 114+ which has Gamepad API. |
| R4 | Touch target increases break the visual design on desktop | Low | Low | Desktop users benefit from larger click targets too. Current design uses generous spacing already. |
| R5 | `force-dynamic` sitemap causes excessive DB load under crawler traffic | Low | Low | Googlebot fetches sitemap ~once daily. `SELECT id, updated_at FROM games` on ~50K rows is single-digit ms on PostgreSQL. |
| R6 | URL-based filter state causes excessive history entries | Medium | Low | Use `router.replace` instead of `router.push` to avoid polluting browser history with every filter change. |

---

## 8. Out of Scope (Explicitly)

- **Steam Deck OLED vs LCD device-specific filtering**: Current device filter already supports this via hardware slugs
- **Steam Machine-specific optimizations**: Already in the hardware table
- **Native mobile app packaging**: PWA-only approach is the stated objective
- **ProtonDB integration beyond existing links**: Already on search results
- **Review snippet rich results**: Structured data for reviews — separate SEO project
- **Dark mode toggle**: Already dark-mode-only by design (`bg-background text-text`)
- **Internationalization / i18n**: English-only for current scope
- **Performance budget enforcement in CI**: Separate devops project
- **Removing `/app/updates/` directory**: Cosmetic, deferred per original spec

---

## 9. Validation Checklist (Post-Implementation)

### Sitemap
- [ ] Sitemap uses `export const dynamic = "force-dynamic"` (NOT `revalidate`)
- [ ] Games with NULL `syncStatus` are included (verified via `sync_status IS NULL` check)
- [ ] DB errors are logged as structured JSON (`console.info`/`console.error` with `event` field)
- [ ] DB errors return partial sitemap (static entries only), not HTTP 500
- [ ] Google Search Console successfully parses and indexes sitemap
- [ ] Cloudflare is NOT caching `/sitemap.xml` (verified in dashboard)
- [ ] `lib/sitemap/` directory is either cleaned up or the old `fetchDynamicEntries` function is deprecated

### PWA
- [ ] Service worker registers without errors in Chrome DevTools
- [ ] Game pages are available offline after first visit
- [ ] `offline.html` served for uncached pages when offline
- [ ] Images from Steam CDN served from cache on revisit
- [ ] Authenticated pages are NOT cached by service worker
- [ ] PWA install prompt appears on Chrome for Android / Steam Deck
- [ ] Manifest icons display correctly on home screen

### Touch & Gamepad
- [ ] All filter controls on `/games` have ≥44×44px touch targets (verified via DevTools element inspection)
- [ ] Gamepad D-pad navigates through game cards on `/games`
- [ ] A button activates/opens focused game
- [ ] B button navigates back
- [ ] Gamepad focus ring appears only after gamepad input
- [ ] Gamepad focus ring disappears on mouse input

### Search & Filters
- [ ] Multi-genre selection filters correctly (OR logic)
- [ ] FPS filter respects device when device filter is active
- [ ] Saved filter load shows visual feedback (highlight + panel collapse)
- [ ] Filter state is reflected in URL query parameters
- [ ] Browser back/forward changes filter state correctly
- [ ] Direct URL with filter params applies filters on load

### Changelog & Version
- [ ] CHANGELOG.md has v2026.0.97 entry
- [ ] `package.json` version is `2026.0.97`

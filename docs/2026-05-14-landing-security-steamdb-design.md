# Architectural Spec: Landing Page, SteamDB Integration, API Security, Changelog

**Date:** 2026-05-14
**Target Version:** 2026.0.101
**Status:** Draft — pending user review

---

## 1. Objective Overview

Four independent workstreams bundled into one release:

| # | Stream | Scope |
|---|--------|-------|
| A | **[Submit] SteamDB Version Auto-Fetch** | Auto-fetch latest game version from SteamDB and surface it in the submit wizard version selector |
| B | **[Feature] Landing Page** | Add trending/hot/new/tested/reported sections below the hero, with a "peek" effect |
| C | **[Infra] API Security & Rate Limiting** | Abuse prevention on submissions, anti-spam for comments, general hardening |
| D | **[CHANGELOG]** | Bump version, write update news, update CHANGELOG.md |

---

## 2. Stream A — SteamDB Version Auto-Fetch

### 2.1 Current State

- `gameVersions` table: `id`, `gameId`, `buildId`, `versionString`, `isLatest`, `createdAt`
- Submit wizard (Setup step) shows a `<select>` of existing versions plus a "New version…" text field
- The submit page server component creates a default empty version if none exists
- Search results already link to `steamdb.info/app/{appId}` as a reference
- No automated version fetching exists

### 2.2 Design

#### 2.2.1 Data Source

SteamDB does not offer a public REST API. The approach is **server-side HTML scraping** of `https://steamdb.info/app/{steamAppId}/` to extract:

- **`versionString`**: The "Last known name" or latest patch/update entry (e.g., "v1.2.3" or "Patch 4")
- **`buildId`**: The numeric build ID shown in the "Builds" or "Last Record Update" section

#### 2.2.2 New API Endpoint

**`GET /api/games/:gameId/steamdb-version`**

- **Auth:** Public (no auth required — this is read-only reference data)
- **Logic:**
  1. Look up the game's `steamAppId`. If `null`, return `{ unavailable: true }`.
  2. Check a cache key (`steamdb:version:{steamAppId}`) — if cached within **6 hours**, return cached data.
  3. Fetch `https://steamdb.info/app/{steamAppId}/` with a reasonable User-Agent header.
  4. Parse the HTML to extract version string and build ID.
  5. Store in cache, return `{ versionString, buildId, fetchedAt }`.
- **Error handling:** If SteamDB is unreachable, returns `{ unavailable: true, reason: "steamdb_unreachable" }`. If parsing fails, returns `{ unavailable: true, reason: "parse_failed" }`.
- **Rate limiting:** SteamDB may block aggressive scraping. Enforce a **per-appId cooldown of 30 minutes** (separate from the 6-hour cache) — if a fetch fails with 429/403, extend cooldown to 24 hours.

#### 2.2.3 Cache Strategy

- **In-memory Map** (consistent with existing rate-limit pattern) keyed by `steamAppId`
- Entry shape: `{ versionString, buildId, fetchedAt, ttl }`
- TTL: 6 hours (game versions don't change minute-to-minute)
- The cache is populated lazily — only when the endpoint is hit

#### 2.2.4 UI Integration in Submit Wizard

In the Setup step's version selector:

1. On mount (or when hardware changes), call `GET /api/games/:gameId/steamdb-version`
2. If data is available, add a special option at the top of the `<select>`:
   ```
   ⬇ Latest from SteamDB: v1.2.3 (Build 12345678) — recommended
   ```
3. Selecting this option triggers version creation with the SteamDB data pre-filled, or (if the build ID already matches an existing version) selects that existing version.
4. The option should be visually distinct (e.g., with a small SteamDB badge/icon) to distinguish it from user-entered versions.

#### 2.2.5 Constraints

- **No SteamDB scraping if `steamAppId` is null** (manual/GOG/Epic games)
- **No automatic version creation** — the user must explicitly choose the SteamDB suggestion
- **Respect SteamDB's rate limits** — do not fetch on every keystroke; fetch only on wizard mount or explicit refresh
- **The scraping is best-effort** — SteamDB may change their HTML structure; graceful degradation is required

### 2.3 New Files

| File | Purpose |
|------|---------|
| `lib/api/steamdb-version.ts` | New Elysia route for the endpoint |
| `lib/steamdb/scrape.ts` | HTML scraping logic (fetch + parse) |
| `lib/steamdb/cache.ts` | In-memory cache with TTL |

### 2.4 Modified Files

| File | Change |
|------|--------|
| `lib/api/index.ts` | Export new `steamdbVersionRoutes` |
| `lib/api/app.ts` | Register `steamdbVersionRoutes` |
| `components/wizard/steps/setup-step.tsx` | Add SteamDB version fetch + special option |
| `app/game/[id]/submit/page.tsx` | No changes needed (data fetched client-side) |

---

## 3. Stream B — Landing Page

### 3.1 Current State

- `app/page.tsx` renders a full-height hero section with animated tagline and search bar
- No game cards, no data sections
- Server-route `/api/dashboard/trending`, `/api/dashboard/best-new-releases`, `/api/dashboard/most-tested`, `/api/dashboard/most-reported` already exist and return data

### 3.2 Design

#### 3.2.1 Layout & "Peek" Effect

```
┌─────────────────────────────────┐
│                                 │
│         HERO SECTION            │  height: calc(100svh - 10svh)
│    (tagline, search, etc.)      │
│                                 │
├─────────────────────────────────┤  ← 10svh of next section peeks above fold
│  ┌───────────────────────────┐  │
│  │  Trending This Week       │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐ │  │
│  │  │Game │ │Game │ │Game │ │  │
│  │  └─────┘ └─────┘ └─────┘ │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  Best New Releases        │  │
│  ...                           │
```

**Implementation:**
- Hero section gets `min-h-[calc(100svh-10svh)]` (formerly `h-[calc(100vh-3.6rem)]`)
- The sections below start immediately, so ~10svh of the first card row is visible without scrolling
- This REQUIRES the hero to not use `overflow: hidden` — let content naturally overflow

#### 3.2.2 Section Order (top to bottom)

1. **Hero** (existing — keep as-is with height adjustment)
2. **Trending This Week** — from `/api/dashboard/trending`
3. **Best Performing New Releases** — from `/api/dashboard/best-new-releases`
4. **Most Tested Games** — from `/api/dashboard/most-tested`
5. **Most Reported Games** — from `/api/dashboard/most-reported`

#### 3.2.3 Card Design

Each section renders a horizontal scrollable row of compact game cards. Card design follows the **search result card** pattern from `app/search/page.tsx`:

- **Cover image** (aspect 2:3, `w-20 sm:w-24 md:w-28`, rounded-lg)
- **Title** (truncated, semibold)
- **Playability badge** (from search card)
- **Relevant stat** (varies by section):
  - Trending: activity score or benchmark count
  - Best New Releases: avg FPS
  - Most Tested: benchmark count
  - Most Reported: report count
- **Hover/tap:** scales to 1.02, redirects to `/game/{id}?sync=1`

#### 3.2.4 Data Fetching Strategy

The landing page remains a **client-side component** (consistent with the current `"use client"` pattern and the search page):

- Hero section keeps its animations and client state (search bar, rotating tagline)
- Data sections fetch from the existing public dashboard endpoints on mount via `useEffect` + `fetch`:
  - `GET /api/dashboard/trending`
  - `GET /api/dashboard/best-new-releases`
  - `GET /api/dashboard/most-tested`
  - `GET /api/dashboard/most-reported`
- Each section shows a **skeleton loader** (pulsing placeholder cards) while fetching
- All 4 fetches fire in parallel via `Promise.all`
- The page does NOT need to be a Server Component — the dashboard queries are fast, public, and the hero already requires client-side interactivity

#### 3.2.5 Empty States

- If a section returns 0 results, hide the section entirely (don't show "No trending games")
- This avoids a dead page for new/quiet periods

#### 3.2.6 Styling Constraints

- Follow existing Tailwind theme variables (`--color-background`, `--color-primary`, `--color-text`, `--color-border`, etc.)
- Section headers: `text-sm font-semibold text-text/80` with a subtle left border accent (`border-l-2 border-primary pl-3`)
- Horizontal scroll: use `overflow-x-auto` with `scrollbar-hide` or custom thin scrollbar
- Cards: replicate the `bg-text/3 border border-border rounded-xl` pattern from search cards
- Use `motion` (framer-motion fork) for stagger animations on card reveal
- Maintain 44px touch targets for interactive elements

### 3.3 New/Modified Files

| File | Change |
|------|--------|
| `app/page.tsx` | Major refactor — add data sections below hero, adjust hero height |
| `components/landing/` | New directory with section components (or inline in page.tsx for MVP) |

---

## 4. Stream C — API Security & Rate Limiting

### 4.1 Current State

- **Rate limiter:** In-memory, global 60s window, 100 requests per IP+path (`lib/auth/rate-limit.ts`)
- **Auth guards:** Role-based (`requireAuth`, `requireRole`, `requireAdmin`, `requireContributorOrAdmin`)
- **Comments:** Auth required, soft-delete, no duplicate/spam detection
- **Submissions:** Auth required, no per-user rate limits
- **Reports:** One per user per entry (DB unique constraint)
- **Community suggestions:** One per user per game per field (DB unique constraint)

### 4.2 Identified Gaps

| Gap | Risk | Severity |
|-----|------|----------|
| No per-route rate limits | A logged-in user can POST comments as fast as they can send requests | Medium |
| No duplicate comment detection | Identical content can be posted repeatedly | Low-Medium |
| No submission flood protection | A user can submit many benchmarks in quick succession | Medium |
| Global rate limit is coarse | All routes share one 100 req/min bucket; legitimate burst traffic may be blocked | Low |
| No content length validation on comments | Extremely long comments could be submitted | Low |
| No input sanitization beyond Elysia validation | Tiptap JSON is stored as-is; XSS risk if renderer is flawed | Low |
| No CSRF protection on state-changing endpoints | Token-based auth mitigates this partially | Low |
| In-memory rate limiter doesn't scale | Multi-instance deployments would have separate counters | Low (current deploy is single-instance) |

### 4.3 Design

#### 4.3.1 Tiered Rate Limiting

Replace the single global rate limiter with **route-category limits**:

| Category | Window | Max Requests | Applies To |
|----------|--------|-------------|------------|
| `default` | 60s | 100 | All unlisted routes |
| `auth` | 60s | 20 | Login, OTP, passkey endpoints |
| `read` | 60s | 300 | GET endpoints (search, listing, game details) |
| `write` | 60s | 10 | POST comment, POST submission, POST report |
| `strict` | 60s | 5 | POST contact form, community suggestion |

**Implementation:**
- Extend `rateLimit` to accept an optional `category` parameter
- Apply different limits per route group in `app.ts`
- Maintain the existing in-memory store pattern (no Redis dependency for now)

#### 4.3.2 Comment Anti-Spam

1. **Duplicate detection (exact match):**
   - Before inserting a comment, check if the user has posted a comment with identical `content` (JSON stringified) to the same game in the last 5 minutes
   - If yes, return `409 Conflict` with `{ error: "Duplicate comment detected" }`

2. **Content length cap:**
   - Validate that `JSON.stringify(body.content).length <= 50000` (50KB)
   - Return `413 Payload Too Large` if exceeded

3. **Rate limit on comment creation:**
   - Covered by the `write` tier (10 req/min per IP)
   - Additional per-user limit: max 30 comments per hour across all games (DB query check)

4. **Ghost-ban pattern (future consideration):**
   - Add `isShadowBanned` boolean to users table (admin-only)
   - Shadow-banned users' comments appear to themselves but are hidden from others
   - **Scope:** Out of scope for this release; note as future enhancement

#### 4.3.3 Submission Abuse Prevention

1. **Per-user submission cooldown:**
   - Before inserting a performance entry, check when the user last submitted ANY entry
   - If < 60 seconds ago, return `429 Too Many Requests` with `{ error: "Please wait before submitting another benchmark", retryAfter: N }`
   - This is a lightweight DB query: `SELECT MAX(createdAt) FROM performance_entries WHERE userId = ?`

2. **Duplicate entry detection:**
   - Check for existing entry with same `userId`, `versionId`, `hardwareSlug`, `upscalerType`, `frameGenMethod` within last 10 minutes
   - If found, warn but don't block (user may be re-submitting with corrections)

3. **Validation hardening:**
   - `fpsAvg`: must be between 1 and 500
   - `fpsLow`/`fpsHigh`/`fpsOnePercentLow`: if provided, must be between 0 and 500
   - `tdpWatts`: if provided, must be between 1 and 100
   - `settingsJson`: maximum 20 categories, each with maximum 50 settings
   - `userNotes`: maximum 5000 characters

#### 4.3.4 Additional Hardening

1. **Input sanitization on comment content:**
   - Strip `<script>` tags and `javascript:` URLs from Tiptap JSON before storage
   - Tiptap's JSON format is generally safe, but add a server-side sanitization pass as defense-in-depth

2. **Rate limit headers on all responses:**
   - Already implemented — ensure they're visible on all routes

3. **CORS review:**
   - Verify CORS headers are restrictive (only allow the app's own origin)

### 4.4 New/Modified Files

| File | Change |
|------|--------|
| `lib/auth/rate-limit.ts` | Extend with category-based limits |
| `lib/api/app.ts` | Apply tiered limits per route group |
| `lib/api/comments.ts` | Add duplicate detection, length cap, content sanitization |
| `lib/api/performance-submit.ts` | Add submission cooldown, duplicate detection, validation hardening |
| `lib/api/community-suggestions.ts` | Add rate limit per user |
| `lib/api/contact.ts` | Add rate limit per IP |

---

## 5. Stream D — Changelog & Version Bump

### 5.1 Version Bump

Current version: `2026.0.100` → New version: `2026.0.101`

Files to update:
- `package.json` → `"version": "2026.0.101"`
- `lib/api/app.ts` → OpenAPI `version: "2026.0.101"`

### 5.2 Changelog Entry

Append to `CHANGELOG.md` following the existing format:

```markdown
## [2026.0.101] - 2026-05-14

### Added
- SteamDB version auto-fetch — latest game version/buid surfaced in submit wizard
- Landing page: Trending This Week, Best New Releases, Most Tested, Most Reported sections
- Tiered API rate limiting with per-category limits
- Comment duplicate detection and content length validation
- Submission cooldown (60s between entries per user)

### Changed
- Landing hero height adjusted to show content "peek" below the fold
- Rate limiter now enforces different limits for auth, read, write, and strict categories

### Security
- Hardened validation on performance entry submission (fps bounds, settings size caps)
- Server-side sanitization of comment content before storage
- Per-route rate limiting categories for granular abuse prevention
```

### 5.3 Update News (Markdown)

Create `content/updates/2026-05-14-v2026.0.101.md`:

Frontmatter:
```yaml
---
title: "Landing Page, SteamDB Version Sync, and Security Hardening"
date: "2026-05-14"
version: "2026.0.101"
summary: "Discover trending games on the new landing page, auto-fetch latest game versions from SteamDB, and enjoy improved API security."
---
```

Sections:
1. **New Landing Page** — trending, new releases, most tested/reported sections below the hero
2. **SteamDB Version Auto-Fetch** — submit wizard now suggests the latest version from SteamDB
3. **API Security Hardening** — tiered rate limits, comment spam prevention, submission validation

---

## 6. Cross-Cutting Concerns

### 6.1 Non-Breaking Changes

All four streams are **additive** — no existing APIs change signature, no database migrations are required. The landing page replaces the current page but the hero section is preserved.

### 6.2 Testing Strategy

| Stream | Test Focus |
|--------|-----------|
| A | Unit test the HTML parser with sample SteamDB HTML; mock HTTP in endpoint test |
| B | Visual regression on landing page; verify all 4 sections render with data and empty states |
| C | Rate limiter unit tests for each tier; integration test for comment duplicate detection |
| D | Verify version consistency across package.json, API spec, and changelog |

### 6.3 Rollout Order

1. **C (Security)** first — foundational, protects everything else
2. **A (SteamDB)** second — independent, can be tested in isolation
3. **B (Landing)** third — depends on existing dashboard APIs (already deployed)
4. **D (Changelog)** last — documents everything above

### 6.4 Rollback Plan

- All changes are additive; rolling back means reverting the commit
- No database migrations = no rollback risk
- SteamDB scraping is best-effort — if it breaks, the wizard falls back to existing behavior

---

## 7. Open Questions for User

1. **Landing page data fetching:** Server Component (import query directly) or client-side fetch? Server Component is better for SEO and initial load but requires `page.tsx` to become async. Client-side is simpler and consistent with current pattern. **Recommendation: Client-side fetch with skeleton loaders** (consistent with search page pattern).

2. **"Most Reported" section visibility:** Should this be public on the landing page, or admin-only? Public visibility may discourage spam (sunlight as disinfectant). Admin-only keeps it cleaner for end users. **Recommendation: Public** (transparency), but with low visual prominence.

3. **SteamDB scraping ethics:** SteamDB is a community resource. Scraping their pages adds load. Should we add a configurable toggle (`STEAMDB_SCRAPING_ENABLED`) so it can be disabled? **Recommendation: Yes**, add an env var gate.

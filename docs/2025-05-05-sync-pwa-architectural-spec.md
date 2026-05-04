# Architectural Spec: Sync Unification, Nav Cleanup & PWA

**Date:** 2025-05-05
**Status:** Draft — Awaiting Tactical Planning
**Author:** Autonomous Architect

---

## 1. Problem Statement

Three distinct objectives converge on a single architectural concern: **data integrity through pipeline unification**. The remaining objectives (nav removal, PWA) are scoped-down implementation tasks that share no domain coupling with the sync work.

### 1.1 Observed Symptoms

| Symptom | Root Cause |
|---|---|
| Steam review scores missing after initial game insert | Two separate code paths insert games; only one fetches review data |
| Review data appears only after manual sync from `/manage` | Manual sync uses the complete `syncSteamGame` pipeline; initial insert does not |
| Playability status not recalculated on initial insert | `recalculatePlayability` is called only in `syncSteamGame`, not in stub creation |

### 1.2 Three Divergent Sync Paths

**Path A — Initial Insert (two locations):**
- `lib/api/game-stub.ts` → `/games/stub` (Elysia API route)
- `app/game/[id]/page.tsx` → `createGameStub()` (Next.js server component)
- Fetches Steam API directly, inserts game row, returns
- **Missing**: `steamReviewScore`, `steamReviewSentiment`, `steamReviewCount`, `recalculatePlayability` call, error tracking fields (`syncRetryCount`, `syncNextRetry`, `syncError`)

**Path B — Stale-While-Revalidate Auto-Sync:**
- `app/game/[id]/page.tsx` → calls `syncSteamGame()`
- `app/games/page.tsx` → calls `syncSteamGame()`
- Uses full pipeline: Steam API + reviews + playability + error tracking

**Path C — Manual Dashboard Sync:**
- `lib/api/games.ts` → `gameSyncRoutes` → `POST /games/:gameId/sync`
- Uses same `syncSteamGame()` as Path B

**Conclusion**: Paths B and C are identical. Path A diverges entirely.

---

## 2. Architecture Boundaries

### 2.1 Source of Truth

`syncSteamGame(steamAppId: number)` in `lib/steam/sync.ts` is the **single canonical sync pipeline**. Every code path that creates or updates a Steam game's data MUST route through this function.

### 2.2 Forbidden Patterns

- No direct `fetch("https://store.steampowered.com/api/appdetails/...")` calls outside of `lib/steam/sync.ts`
- No manual `db.insert(games)` or `db.update(games)` for Steam-sourced games that populates fields covered by `syncSteamGame`
- No duplicate field-mapping logic between Steam API response and DB schema

### 2.3 Allowed Extensions

- `syncSteamGame` may be extended with new fields (e.g., Steam Deck verification status)
- Wrapper functions may call `syncSteamGame` with pre/post hooks (e.g., batch sync with progress reporting)
- The stub-creation flow may insert a **minimal stub** (appId + title only) and then delegate to `syncSteamGame` for full population

---

## 3. Sync Unification Design

### 3.1 Two-Stage Insert Pattern

For initial game creation, use a **stub-then-sync** pattern:

```
User provides steamAppId
    │
    ▼
┌─────────────────────────────┐
│ 1. Check if exists          │
│    (by steamAppId)          │
│    ├─ Exists → return       │
│    └─ New → continue        │
├─────────────────────────────┤
│ 2. Insert MINIMAL stub      │
│    Fields: steamAppId,      │
│    source="steam",          │
│    title (placeholder),     │
│    syncStatus="pending"     │
├─────────────────────────────┤
│ 3. Call syncSteamGame()     │
│    Populates ALL fields:    │
│    title, developer,        │
│    publisher, description,  │
│    genres, images, prices,  │
│    metacritic, reviews,     │
│    platforms, requirements, │
│    categories, releaseDate, │
│    lastSync, syncStatus,    │
│    error tracking           │
├─────────────────────────────┤
│ 4. recalculatePlayability() │
│    (called inside           │
│     syncSteamGame)          │
├─────────────────────────────┤
│ 5. Return complete game     │
└─────────────────────────────┘
```

### 3.2 Affected Files

| File | Change |
|---|---|
| `lib/api/game-stub.ts` | Replace direct Steam fetch + insert with stub insert → `syncSteamGame` call |
| `app/game/[id]/page.tsx` `createGameStub()` | Same refactor; delegate to `syncSteamGame` after minimal stub insert |
| `lib/steam/sync.ts` `syncSteamGame()` | Verify it handles the case where a game row exists but has only stub fields (idempotent update) — current implementation uses `db.update()` so it already requires the row to exist. This is correct for the two-stage pattern. |

### 3.3 Error Semantics

- **Stub insert failure**: Return 500 immediately — database is unreachable
- **Sync failure after stub exists**: The stub persists with `syncStatus="error"` and `syncError` populated. The game page renders with partial data. Retry is governed by exponential backoff in `recordSyncFailure`.
- **Type rejection** (e.g., DLC, soundtrack): The stub should not be inserted. Validate type before inserting the stub, or insert the stub and let `syncSteamGame` mark it as errored (prefer validating upfront to avoid dead rows).

### 3.4 Validation Checklist

After unification, verify:
- [ ] New game insert via search: `steamReviewScore` is populated immediately
- [ ] New game insert via direct URL: `steamReviewScore` is populated immediately
- [ ] Existing stale game visited after 7+ days: auto-sync refreshes all fields
- [ ] Manual sync from `/manage`: no regression (already uses `syncSteamGame`)
- [ ] Non-game Steam IDs (DLC, demos) are rejected before stub creation
- [ ] Playability is recalculated on every sync (insert or update)

---

## 4. Navbar: Remove "Updates"

### 4.1 Scope

Single-file change. No cascading impacts.

### 4.2 Affected Files

| File | Change |
|---|---|
| `lib/routes.ts` | Remove the `{ title: "Updates", href: "/updates" }` entry from the `routes` array |

### 4.3 Considerations

- The `/updates` page directory (`app/updates/`) may remain on disk (dead code). Can be removed in a separate cleanup pass. Priority: remove nav entry immediately.
- No import references to check — `routes` is consumed only by `components/navbar.tsx` and the mobile sidebar, both of which iterate `routes` dynamically.

---

## 5. PWA & Steam Deck UX

### 5.1 Current State

- ✅ Web manifest exists (`app/manifest.ts`) with `display: "standalone"`, theme color, icons
- ❌ No service worker registered — zero offline capability
- ❌ No touch-optimized interactions (hover-dependent UI elements)
- ❌ No gamepad navigation support
- ❌ No `viewport` meta with `user-scalable=no` for installed PWA feel
- ✅ `next.config.ts` has remote image patterns configured (Steam CDN, SteamGridDB)

### 5.2 Design Decisions (Deferred to Tactical Planning)

These require explicit user input — the following are **constraints**, not implementation details:

#### 5.2.1 Offline Strategy

**Constraint**: Must use Workbox or next-pwa for service worker generation. The SW must:
- Precache the app shell (layout, navbar, CSS, fonts)
- Cache game pages on first visit (stale-while-revalidate for HTML, cache-first for images from Steam CDN)
- Cache API responses from the Elysia backend for a short TTL (5 minutes for listings, 1 hour for game details)
- Provide a "You're offline" fallback UI when uncached pages are requested

**Open question**: Should offline mode show a curated "previously viewed" list, or a generic offline message?

#### 5.2.2 Touch Optimization

**Constraint**: All interactive elements must meet a minimum 44×44px touch target (WCAG 2.1 AA). Specific areas:
- Navbar links and hamburger menu
- Game card tap targets (currently `Link` wrapping entire card — verify touch area)
- Filter controls on `/games` (chips, dropdowns)
- Comment submission buttons
- Profile/settings forms

**Open question**: Should touch optimization include a dedicated "Deck Mode" layout toggle, or be applied universally as responsive CSS?

#### 5.2.3 Gamepad Navigation

**Constraint**: Use the Gamepad API (`navigator.getGamepads()`). Implementation must:
- Map D-pad/left stick to focus navigation (roving tabindex)
- Map A button to `click()` on focused element
- Map B button to browser back
- Map L1/R1 (bumpers) to tab switching on game pages
- Provide a visual focus ring distinct from `:focus-visible` so mouse users aren't affected
- Only activate when a gamepad input is detected (not on page load)
- Disable when mouse/keyboard input is detected (reclaim interaction)

**Open question**: Should gamepad support be a global utility hook or scoped to the game detail page only?

### 5.3 PWA Technical Boundaries

- Service worker must NOT cache authenticated pages (profile, manage) — these require live data
- Service worker must NOT cache POST/PATCH/DELETE API responses
- The `manifest.ts` must be updated with proper icon sizes (192px maskable, 512px)
- A `viewport` meta tag must be set in `layout.tsx`: `content="width=device-width, initial-scale=1, viewport-fit=cover"`

---

## 6. Security & Data Integrity Constraints

### 6.1 Steam API Keys

- The Steam Web API key (for reviews) is called server-side only in `syncSteamGame`. No client-side exposure risk.
- The SteamGridDB API key is also server-side only. No change needed.

### 6.2 Rate Limiting

- `syncSteamGame` already has 15s timeout on Steam API calls
- Batch sync in `/manage` has 1.5s inter-request delay
- The background sync in `games/page.tsx` also has 1.5s delay
- **Constraint**: The stub-then-sync pattern must not introduce new burst traffic. Single-game insert is inherently rate-limit-safe (one request per user action).

### 6.3 Database Integrity

- `steamAppId` has a UNIQUE constraint — prevents duplicate stubs
- `syncSteamGame` uses `db.update().where(eq(games.steamAppId, ...))` — safe for re-entry
- **Risk**: If two requests race to create a stub for the same appId, one will fail on UNIQUE constraint. The loser must gracefully return the existing game.

---

## 7. Scope Boundaries

### In Scope
1. Unify initial insert to use `syncSteamGame` pipeline (2 code locations)
2. Remove "Updates" from `lib/routes.ts`
3. PWA architecture constraints and implementation boundaries (spec only — implementation is a separate planning cycle)

### Out of Scope
- Refactoring `syncSteamGame` internals (already correct)
- Removing `/app/updates/` directory (cosmetic cleanup, deferred)
- Adding new Steam API fields beyond what `syncSteamGame` already fetches
- Offline support for `/manage` or authenticated routes
- Native mobile app packaging (PWA only)

---

## 8. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Stub-then-sync pattern doubles API calls for new games | Certain | Low (2 calls instead of 1, 1.5KB payload each) | Acceptable trade-off for data integrity |
| Race condition: two simultaneous stub creations | Low | Low (one returns 409, can be caught) | UNIQUE constraint on `steamAppId` handles this |
| Service worker caches stale game data | Medium | Medium (user sees old reviews/prices) | Stale-while-revalidate strategy + short TTL for game pages |
| Gamepad API not available on all Steam Deck browser versions | Low | High (feature non-functional) | Feature-detect and silently degrade; SteamOS 3.5+ ships Chromium 114+ with Gamepad API support |

---

## 9. Dependencies

- **Sync unification**: No external dependencies. Pure refactor of existing code.
- **Nav removal**: No dependencies.
- **PWA**: Requires `next-pwa` or `@serwist/next` package, plus `workbox-webpack-plugin` configuration. These are new production dependencies that must be vetted for Next.js 15+ compatibility.

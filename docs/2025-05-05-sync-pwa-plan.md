# Sync Unification, Nav Cleanup & PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all Steam game data pipelines through a single `syncSteamGame` function, remove the Updates nav link, and lay PWA groundwork.

**Architecture:** Adopt a stub-then-sync pattern: insert a minimal database row (appId + placeholder title), then immediately call `syncSteamGame` which populates all fields including reviews, error tracking, and playability. Two divergent insert locations are collapsed into one canonical path. PWA tasks are out of scope for this plan (per spec §7 — separate planning cycle).

**Tech Stack:** Next.js 15 (App Router), Elysia (API), Drizzle ORM (PostgreSQL), Vitest (testing)

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `lib/steam/sync.ts` | Expose `ensureSteamGame` — the new unified entry point |
| Modify | `lib/api/game-stub.ts` | Replace direct Steam fetch + insert with `ensureSteamGame` |
| Modify | `app/game/[id]/page.tsx` | Replace `createGameStub` with `ensureSteamGame` |
| Modify | `lib/routes.ts` | Remove Updates nav entry |
| Create | `lib/steam/__tests__/ensure-steam-game.test.ts` | Unit tests for the new unified function |

No new files beyond the test file. The PWA scope is explicitly deferred.

---

## Phase 1: Expose `ensureSteamGame` in sync.ts

This phase creates the new unified entry point. It does not yet consume it — that happens in Phase 2. This isolates the core logic change so it can be tested independently.

### Task 1: Add `ensureSteamGame` to `lib/steam/sync.ts`

**Files:**
- Modify: `lib/steam/sync.ts`

- [ ] **Step 1: Add the `ensureSteamGame` function after the `syncSteamGame` export**

Add the following function at the end of `lib/steam/sync.ts` (after the `syncSteamGame` function):

```typescript
/**
 * Ensure a Steam game exists in the database with full data.
 * If the game doesn't exist, inserts a minimal stub then runs a full sync.
 * If the game already exists, returns it without re-syncing.
 *
 * This is the SINGLE ENTRY POINT for creating new Steam game records.
 * Use this instead of direct Steam API fetches + manual inserts.
 */
export async function ensureSteamGame(
  steamAppId: number
): Promise<{ game: typeof games.$inferSelect | null; created: boolean; error?: string }> {
  // 1. Check if game already exists
  const [existing] = await db
    .select()
    .from(games)
    .where(eq(games.steamAppId, steamAppId))
    .limit(1)

  if (existing) {
    return { game: existing, created: false }
  }

  // 2. Insert minimal stub
  const [stub] = await db
    .insert(games)
    .values({
      steamAppId,
      source: "steam",
      title: `Steam App ${steamAppId}`,
      storeUrl: `https://store.steampowered.com/app/${steamAppId}`,
      syncStatus: "pending",
    })
    .returning()

  // Handle race condition: if another request inserted first, UNIQUE constraint
  // on steamAppId will throw. Catch and return the existing record.
  if (!stub) {
    const [raceWinner] = await db
      .select()
      .from(games)
      .where(eq(games.steamAppId, steamAppId))
      .limit(1)
    return { game: raceWinner ?? null, created: false }
  }

  // 3. Run full sync (forceRetry=true to bypass staleness check on a brand-new record)
  const syncResult = await syncSteamGame(steamAppId, { forceRetry: true })

  if (!syncResult.success) {
    // Sync failed — return the stub (it has error tracking fields populated by
    // recordSyncFailure inside syncSteamGame). Re-fetch to get updated fields.
    const [failedGame] = await db
      .select()
      .from(games)
      .where(eq(games.steamAppId, steamAppId))
      .limit(1)
    return { game: failedGame ?? null, created: true, error: syncResult.error }
  }

  // 4. Return fully populated game
  const [fullGame] = await db
    .select()
    .from(games)
    .where(eq(games.steamAppId, steamAppId))
    .limit(1)

  return { game: fullGame ?? null, created: true }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to `lib/steam/sync.ts`. There may be pre-existing errors in other files — those are out of scope.

- [ ] **Step 3: Commit**

```bash
git add lib/steam/sync.ts
git commit -m "feat: add ensureSteamGame — unified stub-then-sync entry point"
```

---

### Task 2: Write unit tests for `ensureSteamGame`

**Files:**
- Create: `lib/steam/__tests__/ensure-steam-game.test.ts`

Because this function makes external API calls to Steam and touches the database, the tests mock `syncSteamGame` and the database layer. The tests verify the orchestration logic, not the Steam API integration (that's already covered by `syncSteamGame`'s own behavior).

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the database module
const mockSelect = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockLimit = vi.fn()
const mockValues = vi.fn()
const mockReturning = vi.fn()

// Chain the Drizzle query builder
const createChain = (finalValue: unknown) => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.from = vi.fn().mockReturnValue(chain)
  chain.where = vi.fn().mockReturnValue(chain)
  chain.limit = vi.fn().mockResolvedValue(finalValue)
  chain.insert = vi.fn().mockReturnValue(chain)
  chain.values = vi.fn().mockReturnValue(chain)
  chain.returning = vi.fn().mockResolvedValue(finalValue)
  chain.update = vi.fn().mockReturnValue(chain)
  chain.set = vi.fn().mockReturnValue(chain)
  return chain
}

vi.mock("@/lib/db/index", () => {
  const chain = createChain([])
  return { db: chain }
})

vi.mock("@/lib/db/schema", () => ({
  games: {
    steamAppId: "steam_app_id",
    id: "id",
    source: "source",
    title: "title",
  },
  steamReviewSentimentEnum: {
    enumValues: [
      "overwhelmingly_positive",
      "very_positive",
      "positive",
      "mostly_positive",
      "mixed",
      "mostly_negative",
      "negative",
      "very_negative",
      "overwhelmingly_negative",
    ],
  },
}))

vi.mock("@/lib/api/playability", () => ({
  recalculatePlayability: vi.fn().mockResolvedValue({
    gamePlayability: "unknown",
    deviceResults: [],
  }),
}))

// We mock syncSteamGame itself since ensureSteamGame calls it
vi.mock("@/lib/steam/sync", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/steam/sync")>()
  return {
    ...original,
    syncSteamGame: vi.fn().mockResolvedValue({ success: true }),
  }
})

// Import after mocks are set up
const { ensureSteamGame } = await import("@/lib/steam/sync")
const { syncSteamGame } = await import("@/lib/steam/sync")
const { db } = await import("@/lib/db/index")

describe("ensureSteamGame", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing game without re-syncing when game already exists", async () => {
    const existingGame = {
      id: "existing-id",
      steamAppId: 12345,
      title: "Existing Game",
      source: "steam",
      steamReviewScore: 85,
    }

    // Mock: db.select().from(games).where(eq(games.steamAppId, 12345)).limit(1) → [existingGame]
    // We need to rebuild the mock chain for this specific scenario
    const chain = createChain([existingGame])
    Object.assign(db, chain)

    const result = await ensureSteamGame(12345)

    expect(result.created).toBe(false)
    expect(result.game).toEqual(existingGame)
    expect(syncSteamGame).not.toHaveBeenCalled()
  })

  it("creates stub and syncs when game does not exist", async () => {
    const stubGame = {
      id: "new-id",
      steamAppId: 67890,
      title: "Steam App 67890",
      source: "steam",
      syncStatus: "pending",
    }

    const syncedGame = {
      ...stubGame,
      title: "Real Game Name",
      steamReviewScore: 92,
      syncStatus: "synced",
      lastSync: new Date(),
    }

    // First call (existence check): empty array
    // Second call (after sync): [syncedGame]
    let selectCallCount = 0
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    chain.select = vi.fn().mockImplementation(() => chain)
    chain.from = vi.fn().mockImplementation(() => chain)
    chain.where = vi.fn().mockImplementation(() => chain)
    chain.limit = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) return Promise.resolve([]) // doesn't exist
      return Promise.resolve([syncedGame]) // after sync, return populated
    })
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.values = vi.fn().mockReturnValue(chain)
    chain.returning = vi.fn().mockResolvedValue([stubGame])

    Object.assign(db, chain)
    ;(syncSteamGame as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    const result = await ensureSteamGame(67890)

    expect(result.created).toBe(true)
    expect(db.insert).toHaveBeenCalled()
    expect(syncSteamGame).toHaveBeenCalledWith(67890, { forceRetry: true })
    expect(result.game?.title).toBe("Real Game Name")
    expect(result.game?.steamReviewScore).toBe(92)
  })

  it("handles sync failure gracefully — returns stub with error info", async () => {
    const stubGame = {
      id: "fail-id",
      steamAppId: 99999,
      title: "Steam App 99999",
      source: "steam",
      syncStatus: "pending",
    }

    const failedGame = {
      ...stubGame,
      syncStatus: "error",
      syncError: "Steam API returned 429",
    }

    let selectCallCount = 0
    const chain: Record<string, ReturnType<typeof vi.fn>> = {}
    chain.select = vi.fn().mockImplementation(() => chain)
    chain.from = vi.fn().mockImplementation(() => chain)
    chain.where = vi.fn().mockImplementation(() => chain)
    chain.limit = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) return Promise.resolve([])
      return Promise.resolve([failedGame])
    })
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.values = vi.fn().mockReturnValue(chain)
    chain.returning = vi.fn().mockResolvedValue([stubGame])

    Object.assign(db, chain)
    ;(syncSteamGame as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "Steam API returned 429",
    })

    const result = await ensureSteamGame(99999)

    expect(result.created).toBe(true)
    expect(result.error).toBe("Steam API returned 429")
    expect(result.game?.syncStatus).toBe("error")
  })

  it("calls syncSteamGame with forceRetry=true to bypass staleness check", async () => {
    const chain = createChain([]) // no existing game
    chain.insert = vi.fn().mockReturnValue(chain)
    chain.values = vi.fn().mockReturnValue(chain)
    chain.returning = vi.fn().mockResolvedValue([{ id: "x", steamAppId: 11111 }])

    // After sync, re-fetch returns populated game
    let selectCallCount = 0
    chain.limit = vi.fn().mockImplementation(() => {
      selectCallCount++
      if (selectCallCount === 1) return Promise.resolve([])
      return Promise.resolve([{ id: "x", steamAppId: 11111, steamReviewScore: 80 }])
    })

    Object.assign(db, chain)
    ;(syncSteamGame as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

    await ensureSteamGame(11111)

    expect(syncSteamGame).toHaveBeenCalledWith(11111, { forceRetry: true })
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run lib/steam/__tests__/ensure-steam-game.test.ts`
Expected: All tests pass. Mock-based tests may be fragile; adjust mock chains if the Drizzle query shape doesn't match.

- [ ] **Step 3: Commit**

```bash
git add lib/steam/__tests__/ensure-steam-game.test.ts
git commit -m "test: add unit tests for ensureSteamGame stub-then-sync"
```

---

## Phase 2: Replace Divergent Insert Paths

Now we consume `ensureSteamGame` in the two locations that currently bypass the unified pipeline.

### Task 3: Refactor `lib/api/game-stub.ts` to use `ensureSteamGame`

**Files:**
- Modify: `lib/api/game-stub.ts`

- [ ] **Step 1: Replace the entire route handler with `ensureSteamGame`**

Replace the full content of `lib/api/game-stub.ts` with:

```typescript
import { Elysia, t } from "elysia"
import { ensureSteamGame } from "@/lib/steam/sync"

export const gameStubRoutes = new Elysia({ prefix: "/games" }).post(
  "/stub",
  async ({ body, set }) => {
    const result = await ensureSteamGame(body.steamAppId)

    if (!result.game) {
      set.status = 500
      return { error: "Failed to create or retrieve game" }
    }

    // If game already existed, return 200 with created:false
    if (!result.created) {
      return { game: result.game, created: false }
    }

    // If sync failed but stub exists, still return 201 with error info
    if (result.error) {
      set.status = 201
      return { game: result.game, created: true, syncError: result.error }
    }

    set.status = 201
    return { game: result.game, created: true }
  },
  {
    body: t.Object({
      steamAppId: t.Number(),
    }),
  },
)
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors. The `SteamAppDetails` interface and `validateImageUrl`/`fetchSteamGridDBCover` imports are now unused — they should be removed, which Step 1 already does.

- [ ] **Step 3: Verify the /games/stub API route still works**

Run: `curl -s -X POST http://localhost:3001/api/games/stub -H "Content-Type: application/json" -d '{"steamAppId": 440}" | head -200` (or use the dev server).

If the dev server is not running, skip this manual check — the unit tests in Task 2 cover the logic.

- [ ] **Step 4: Commit**

```bash
git add lib/api/game-stub.ts
git commit -m "refactor: game-stub route now uses ensureSteamGame pipeline"
```

---

### Task 4: Refactor `app/game/[id]/page.tsx` `createGameStub` to use `ensureSteamGame`

**Files:**
- Modify: `app/game/[id]/page.tsx`

- [ ] **Step 1: Replace the `createGameStub` function and update the import**

In `app/game/[id]/page.tsx`, make these changes:

**a. Update the import line** — change:
```typescript
import { isSyncStale, syncSteamGame } from "@/lib/steam/sync"
```
to:
```typescript
import { isSyncStale, syncSteamGame, ensureSteamGame } from "@/lib/steam/sync"
```

**b. Replace the entire `createGameStub` function** (lines 73–127) with:

```typescript
async function createGameStub(steamAppId: number) {
    const result = await ensureSteamGame(steamAppId)
    if (!result.game) {
        notFound()
    }
    // If the game was rejected by Steam (e.g., DLC, soundtrack),
    // ensureSteamGame's sync will have set syncStatus="error".
    // We still return the game record — the page will render with
    // partial data and the sync error will be visible.
    return result.game
}
```

The old `createGameStub` (lines 73–127) was 55 lines. The new one is 8 lines. All the Steam API fetching, type validation, image validation, and field mapping is now handled by `syncSteamGame` inside `ensureSteamGame`.

- [ ] **Step 2: Remove the now-unused duplicate `SteamAppDetails` type**

The old `createGameStub` defined an inline `SteamAppDetails` type. Since we removed that code, verify there are no remaining references to it in `page.tsx`. Search for `SteamAppDetails` — it should not appear. If it does, remove it.

- [ ] **Step 3: Verify the `notFound()` early-exit for non-game types still works**

In the old code, `createGameStub` called `notFound()` when `entry.data.type !== "game"`. In the new code, `syncSteamGame` sets `syncStatus: "error"` when it encounters a non-game type. The page still renders — it doesn't call `notFound()`.

This is a **behavioral change**: previously, visiting a DLC's Steam app ID resulted in a 404. Now it results in a game page with an error banner.

If the 404 behavior is required, add a check after `ensureSteamGame`:

```typescript
async function createGameStub(steamAppId: number) {
    const result = await ensureSteamGame(steamAppId)
    if (!result.game) {
        notFound()
    }
    // If the sync determined this is not a game (DLC, soundtrack, etc.),
    // treat it as not found rather than showing a broken page
    if (result.game.syncStatus === "error" && result.error?.includes("not a game")) {
        notFound()
    }
    return result.game
}
```

**Include this version** — it preserves the original 404 behavior for non-game types.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add app/game/[id]/page.tsx
git commit -m "refactor: createGameStub now uses ensureSteamGame pipeline"
```

---

### Task 5: Verify no other direct Steam API calls exist outside `sync.ts`

**Files:**
- No modifications — verification only

- [ ] **Step 1: Search for direct Steam API URL patterns outside of sync.ts**

Run:
```bash
grep -rn "store.steampowered.com/api/appdetails" --include="*.ts" --include="*.tsx" | grep -v "lib/steam/sync.ts" | grep -v "node_modules" | grep -v ".next"
```

Expected: **Zero results**. If any appear, they represent additional divergent paths that must be refactored to use `ensureSteamGame`.

- [ ] **Step 2: Search for direct Steam review API calls outside of sync.ts**

Run:
```bash
grep -rn "store.steampowered.com/appreviews" --include="*.ts" --include="*.tsx" | grep -v "lib/steam/sync.ts" | grep -v "node_modules" | grep -v ".next"
```

Expected: **Zero results**.

- [ ] **Step 3: Commit the verification (or fix any found issues first)**

If issues found: fix, commit with message like `refactor: route <location> through ensureSteamGame`
If clean: no commit needed — move to Phase 3.

---

## Phase 3: Nav Cleanup

Independent of sync work. Can be done in parallel with Phase 2 tasks.

### Task 6: Remove "Updates" from navigation routes

**Files:**
- Modify: `lib/routes.ts`

- [ ] **Step 1: Remove the Updates route entry**

In `lib/routes.ts` (line ~18), remove this entry:

```typescript
    {
        title: "Updates",
        href: "/updates",
    },
```

The file should look like this after:

```typescript
export const routes = [
    {
        title: "Home",
        href: "/",
    },
    {
        title: "Search",
        href: "/search",
    },
    {
        title: "Games",
        href: "/games",
    },
    {
        title: "Compare",
        href: "/compare",
    },
    {
        title: "Devices",
        href: "/devices",
    },
    {
        title: "Contact",
        href: "/contact",
    },
]
```

- [ ] **Step 2: Verify the navbar renders without Updates**

Run: `npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: No errors. The `navbar.tsx` component iterates `routes` dynamically — removing an entry from the array doesn't break anything.

- [ ] **Step 3: Commit**

```bash
git add lib/routes.ts
git commit -m "fix: remove Updates from navigation routes"
```

---

## Phase 4: Integration Verification

After all code changes are in place, verify the end-to-end behavior.

### Task 7: Full integration check

**Files:**
- No modifications — verification only

- [ ] **Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit --pretty`
Expected: Zero errors (or only pre-existing errors unrelated to this change).

- [ ] **Step 2: Run the test suite**

Run: `npx vitest run`
Expected: All passing.

- [ ] **Step 3: Run linter**

Run: `npx eslint lib/steam/sync.ts lib/api/game-stub.ts app/game/[id]/page.tsx lib/routes.ts --max-warnings=0`
Expected: No new lint errors. Fix any that appear.

- [ ] **Step 4: Manual smoke test — new game insert**

If the dev server is available:
1. Navigate to a game page via Steam app ID that doesn't exist in the database
2. Verify the page loads with full data including review scores
3. Check the database directly: `SELECT steam_review_score, steam_review_sentiment, steam_review_count FROM games WHERE steam_app_id = <id>`
4. Expected: All three fields are populated (not null, assuming Steam has review data)

- [ ] **Step 5: Manual smoke test — nav without Updates**

1. Load the site
2. Verify the navbar shows: Home (on landing), Games, Compare, Devices, Contact
3. Verify "Updates" does not appear in desktop nav or mobile hamburger menu

- [ ] **Step 6: Commit final state (if any lint fixes needed)**

```bash
git add -A
git commit -m "chore: lint fixes from sync unification"
```

---

## Phase 5: Verification Checklist against Spec

Cross-reference the architectural spec's §3.4 validation checklist.

### Task 8: Validate against spec checklist

- [ ] **New game insert via search: `steamReviewScore` is populated immediately** — verified by Task 7 Step 4
- [ ] **New game insert via direct URL: `steamReviewScore` is populated immediately** — verified by Task 7 Step 4
- [ ] **Existing stale game visited after 7+ days: auto-sync refreshes all fields** — not modified, already working via `syncSteamGame` in `game/[id]/page.tsx`
- [ ] **Manual sync from `/manage`: no regression** — `/manage` uses `syncSteamGame` directly, unchanged
- [ ] **Non-game Steam IDs (DLC, demos) are rejected before stub creation** — `ensureSteamGame` → `syncSteamGame` rejects and records error, `createGameStub` calls `notFound()` for non-game type errors
- [ ] **Playability is recalculated on every sync** — `syncSteamGame` already calls `recalculatePlayability` on success; now it also runs for new inserts via `ensureSteamGame`

No commit needed — this is a verification pass.

---

## PWA Scope — Explicitly Deferred

Per the architectural spec §7, PWA implementation is out of scope for this plan. The open design questions (offline strategy, touch scope, gamepad scope) require user input before a tactical plan can be written. Once answered, a separate plan document should be created:

- `docs/2025-05-05-pwa-plan.md` (future)

The PWA spec constraints are documented in the architectural spec §5 for reference when that plan is written.
# Devices Redesign & Admin Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical device page bugs, redesign devices list/detail pages with proper SEO, remove the broken Community Trust graph, and add an admin management panel with nested routes for Users, Hardware, and Games.

**Architecture:** Server components fetch data and pass as props (true RSC pattern). Admin panel uses a `(admin)` route group with shared sidebar layout and nested routes. All devices code fixes the `"handled"` → `"handheld"` enum typo and the `upscalerBreakdown`/`fsrBreakdown` property mismatch.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Drizzle ORM (PostgreSQL), better-auth (admin plugin), Elysia API, Framer Motion v12, ECharts, Lucide React icons

---

### Task 1: DB Migration — Rename Enum & Add Image Column

**Files:**
- Create: `drizzle/0011_rename-handled-to-handheld-add-image.sql`
- Modify: `lib/db/schema/hardware.ts`
- Modify: `lib/db/seed.ts`

- [ ] **Step 1: Create the SQL migration file**

Create `drizzle/0011_rename-handled-to-handheld-add-image.sql`:

```sql
-- Rename pg_enum value from 'handled' to 'handheld'
ALTER TYPE device_type RENAME VALUE 'handled' TO 'handheld';

-- Add nullable image column to hardware table
ALTER TABLE hardware ADD COLUMN image text;
```

- [ ] **Step 2: Update the Drizzle schema to match**

In `lib/db/schema/hardware.ts`, change the enum and add the image column:

```ts
import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const deviceTypeEnum = pgEnum("device_type", ["handheld", "console"])

export const hardware = pgTable("hardware", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  deviceType: deviceTypeEnum("device_type").notNull(),
  image: text("image"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
```

- [ ] **Step 3: Update the seed file**

In `lib/db/seed.ts`, change all `"handled" as const` to `"handheld" as const`:

```ts
const devices = [
  {
    slug: "steamdeck-oled",
    name: "Steam Deck OLED",
    deviceType: "handheld" as const,
    sortOrder: 0,
  },
  {
    slug: "steamdeck-lcd",
    name: "Steam Deck LCD",
    deviceType: "handheld" as const,
    sortOrder: 1,
  },
  {
    slug: "steam-machine",
    name: "Steam Machine",
    deviceType: "console" as const,
    sortOrder: 2,
  },
]
```

- [ ] **Step 4: Run the migration**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bunx drizzle-kit push`
Expected: Migration applies — enum value renamed, image column added.

- [ ] **Step 5: Run the seed to verify**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run lib/db/seed.ts`
Expected: No conflict errors, devices seeded with `"handheld"` type.

- [ ] **Step 6: Commit**

```bash
git add drizzle/0011_rename-handled-to-handheld-add-image.sql lib/db/schema/hardware.ts lib/db/seed.ts
git commit -m "fix: rename device_type enum 'handled' to 'handheld', add image column"
```

---

### Task 2: Fix API Bug Fixes — avgFps Nulls & upscalerBreakdown Consistency

**Files:**
- Modify: `lib/api/hardware-stats.ts`

- [ ] **Step 1: Fix avgFps calculation to exclude null FPS entries**

In `lib/api/hardware-stats.ts`, locate the `/:slug/stats` handler and replace the `avgFps` calculation:

**Old code (around line ~90):**
```ts
const avgFps = Math.round(
  (entries.reduce((s, e) => s + (e.fpsAvg ?? 0), 0) / totalBenchmarks) * 10
) / 10
```

**New code:**
```ts
// Filter out null FPS entries before computing average (SQL avg() ignores nulls)
const fpsEntries = entries.filter((e) => e.fpsAvg !== null)
const avgFps =
  fpsEntries.length > 0
    ? Math.round(
        (fpsEntries.reduce((s, e) => s + e.fpsAvg!, 0) / fpsEntries.length) * 10
      ) / 10
    : null
```

- [ ] **Step 2: Verify the API response shape uses `upscalerBreakdown` consistently**

The API already returns `upscalerBreakdown` (this is the correct name). Confirm there is no `fsrBreakdown` in the API file. No changes needed here — the fix happens in the client component (Task 5).

- [ ] **Step 3: Run the dev server and test the endpoint**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && curl -s http://localhost:3000/api/hardware/steamdeck-oled/stats | head -c 200`
Expected: JSON response with `avgFps` reflecting only non-null entries, and `upscalerBreakdown` (not `fsrBreakdown`).

- [ ] **Step 4: Commit**

```bash
git add lib/api/hardware-stats.ts
git commit -m "fix: exclude null FPS entries from avgFps calculation in device stats API"
```

---

### Task 3: Remove Community Trust Chart

**Files:**
- Modify: `app/game/[id]/game-page-client.tsx`
- Modify: `lib/api/game-stats.ts`
- Delete: `components/charts/TrustBar.tsx`

- [ ] **Step 1: Remove TrustBar from game-page-client.tsx**

In `app/game/[id]/game-page-client.tsx`:

1. **Remove the import** (line ~34):
   Delete: `import { TrustBar } from "@/components/charts/TrustBar"`

2. **Remove trust from the stats interface** (around line ~143):
   Delete the entire `trust` array from the interface:
   ```ts
   // DELETE these lines:
   trust: Array<{
     id: string
     hardwareSlug: string
     upvotes: number
     downvotes: number
     verifiedAt: string | null
     userNotes: string | null
     createdAt: string
   }>
   ```

3. **Remove trust from filteredStats** (around line ~326):
   Delete the line: `trust: filterByDevice(stats.trust),`

4. **Remove the Community Trust render section** (around line ~995):
   Delete the entire block:
   ```tsx
   {/* Row 4 — Trust Bar */}
   {filteredStats && filteredStats.trust.length > 0 && (
     <div className='rounded-xl border border-border bg-text/3 p-4'>
       <h3 className='text-sm font-medium text-text/80 mb-2'>
         Community Trust
       </h3>
       <TrustBar data={filteredStats.trust} />
     </div>
   )}
   ```

- [ ] **Step 2: Remove trust data from game-stats API**

In `lib/api/game-stats.ts`:

1. **Remove Section 9** (trust data mapping, around line ~242):
   Delete:
   ```ts
   // ── 9. Community trust ────────────────────────────────────────
   const trust = entries.map((e) => ({
     id: e.id,
     hardwareSlug: e.hardwareSlug,
     upvotes: e.upvotes,
     downvotes: e.downvotes,
     verifiedAt: e.verifiedAt ? e.verifiedAt.toISOString() : null,
     userNotes: e.userNotes,
     createdAt: e.createdAt.toISOString(),
   }))
   ```

2. **Remove `trust` from the empty return** (around line ~77):
   Change: `trust: [],` → remove this line

3. **Remove `trust` from the final return object** (around line ~276):
   Delete the line: `trust,`

- [ ] **Step 3: Delete the TrustBar component file**

Delete: `components/charts/TrustBar.tsx`

- [ ] **Step 4: Verify no other imports of TrustBar exist**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && grep -r "TrustBar" --include="*.tsx" --include="*.ts" app/ components/ lib/`
Expected: No results (TrustBar fully removed from codebase).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove broken Community Trust chart (TrustBar)

- Remove TrustBar component and chart
- Remove trust data from game-stats API response
- Remove trust section from game detail page
- DB columns and vote endpoints preserved for future voting system"
```
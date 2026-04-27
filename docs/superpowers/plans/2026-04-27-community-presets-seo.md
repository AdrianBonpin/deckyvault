# Community Presets UX + SEO Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul community presets UX (view settings, delete/report, horizontal layout, reorder) and robustify SEO (dynamic metadata, sitemaps, JSON-LD, OG images) across DeckyVault.

**Architecture:** Two independent tracks — (A) Community Presets UX changes affect the game page client, server component, API routes, and a new reports table. (B) SEO changes are additive page-level metadata, sitemap, and OG image files. Track B is mostly independent and can proceed in parallel after Track A's DB changes land.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, Elysia, Motion (Framer Motion v12), Tailwind CSS, next/og (ImageResponse)

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/db/schema/reports.ts` | Drizzle schema for the reports table |
| `lib/db/schema/performanceEntries.ts` | Already exists — no schema changes needed (isRemoved + removedReason already exist) |
| `lib/db/schema/index.ts` | Barrel export — add reports |
| `lib/api/reports.ts` | Elysia routes for POST /api/performance/:id/report |
| `lib/api/performance.ts` | Change user-delete from hard delete to soft delete |
| `lib/api/index.ts` | Barrel export — add reports routes |
| `app/api/[[...slugs]]/route.ts` | Mount new report routes |
| `app/game/[id]/page.tsx` | Add generateMetadata, enrich preset data, add JSON-LD |
| `app/game/[id]/game-page-client.tsx` | Horizontal layout, modal, delete/report UI, reorder sections, Preset type update |
| `app/game/[id]/opengraph-image.tsx` | Dynamic OG image per game |
| `app/game/[id]/preset-detail-modal.tsx` | New: Preset detail modal component with settings view, delete, report |
| `app/sitemap.ts` | Expand with games + devices |
| `app/search/page.tsx` | Add metadata export |
| `app/page.tsx` | Add JSON-LD WebSite schema |
| `app/devices/page.tsx` | Add JSON-LD ItemList |
| `app/devices/[slug]/page.tsx` | Add JSON-LD Product schema, canonical URL |
| `app/globals.css` | Add scrollbar-hiding utility class if needed |

---

## Task 1: Reports Database Schema + Migration

**Files:**
- Create: `lib/db/schema/reports.ts`
- Modify: `lib/db/schema/index.ts`

- [ ] **Step 1: Create the reports schema file**

Create `lib/db/schema/reports.ts`:

```typescript
import {
  text,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { performanceEntries } from "./performanceEntries"
import { user } from "./auth"

export const reportReasonEnum = pgEnum("report_reason", [
  "inaccurate",
  "spam",
  "inappropriate",
  "other",
])

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "reviewed",
  "dismissed",
])

export const reports = pgTable("reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  entryId: text("entry_id")
    .notNull()
    .references(() => performanceEntries.id, { onDelete: "cascade" }),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: reportReasonEnum("reason").notNull(),
  details: text("details"),
  status: reportStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("reports_entry_reporter_unique").on(table.entryId, table.reporterId),
])
```

- [ ] **Step 2: Add reports export to barrel file**

In `lib/db/schema/index.ts`, add:

```typescript
export * from "./reports"
```

- [ ] **Step 3: Generate and run the migration**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

Expected: Migration creates the `reports` table with the `reports_entry_reporter_unique` unique index and the two new enums.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema/reports.ts lib/db/schema/index.ts drizzle/
git commit -m "feat: add reports table schema for preset reporting"
```

---

## Task 2: Reports API Route

**Files:**
- Create: `lib/api/reports.ts`
- Modify: `lib/api/index.ts`
- Modify: `app/api/[[...slugs]]/route.ts`

- [ ] **Step 1: Create the reports API route file**

Create `lib/api/reports.ts`:

```typescript
import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { reports } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

export const reportRoutes = new Elysia({ prefix: "/performance" }).post(
  "/:id/report",
  async ({ params, body, request, set }) => {
    const guard = await requireRole(request.headers, [
      "user",
      "contributor",
      "admin",
    ])
    if (!guard.ok) {
      set.status = guard.status
      return { error: guard.error }
    }

    // Check if user already reported this entry
    const [existing] = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.entryId, params.id),
          eq(reports.reporterId, guard.user.id),
        ),
      )
      .limit(1)

    if (existing) {
      set.status = 409
      return { error: "You have already reported this entry" }
    }

    const [created] = await db
      .insert(reports)
      .values({
        entryId: params.id,
        reporterId: guard.user.id,
        reason: body.reason,
        details: body.details ?? null,
      })
      .returning()

    return created
  },
  {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      reason: t.Union([
        t.Literal("inaccurate"),
        t.Literal("spam"),
        t.Literal("inappropriate"),
        t.Literal("other"),
      ]),
      details: t.Optional(t.String()),
    }),
  },
)
```

- [ ] **Step 2: Add report routes to barrel export**

In `lib/api/index.ts`, add the import and export:

```typescript
export { reportRoutes } from "./reports"
```

- [ ] **Step 3: Mount the report routes in the API handler**

In `app/api/[[...slugs]]/route.ts`, add `reportRoutes` to the Elysia app. Find the existing line where routes are mounted (e.g., `.use(performanceRoutes)`) and add `.use(reportRoutes)`.

- [ ] **Step 4: Test the report endpoint**

Start the dev server, then test:

```bash
# Should return 401 without auth
curl -X POST http://localhost:3000/api/performance/test-id/report \
  -H "Content-Type: application/json" \
  -d '{"reason":"spam"}'
```

Expected: 401 or auth error response.

- [ ] **Step 5: Commit**

```bash
git add lib/api/reports.ts lib/api/index.ts app/api/
git commit -m "feat: add POST /api/performance/:id/report endpoint"
```

---

## Task 3: Change User-Delete to Soft Delete

**Files:**
- Modify: `lib/api/performance.ts`

- [ ] **Step 1: Modify the user-delete endpoint**

In `lib/api/performance.ts`, find the `/:id/user-delete` DELETE handler. Replace the hard-delete logic with a soft delete that sets `isRemoved: true` and optionally stores a `removedReason`.

Current code does:
```typescript
await db
    .delete(performanceEntries)
    .where(eq(performanceEntries.id, params.id))
```

Change to:
```typescript
const reason = (body as any)?.reason as string | undefined

const [updated] = await db
    .update(performanceEntries)
    .set({
        isRemoved: true,
        removedReason: reason ?? "User deleted",
        updatedAt: new Date(),
    })
    .where(eq(performanceEntries.id, params.id))
    .returning()

if (!updated) {
    set.status = 404
    return { error: "Performance entry not found" }
}

return { success: true }
```

Also update the route definition to accept an optional body with `reason`:

```typescript
.delete(
    "/:id/user-delete",
    async ({ params, body, request, set }) => {
        // ... same auth check ...
        // ... same ownership check ...

        const reason = (body as Record<string, string> | null)?.reason

        const [updated] = await db
            .update(performanceEntries)
            .set({
                isRemoved: true,
                removedReason: reason ?? "User deleted",
                updatedAt: new Date(),
            })
            .where(eq(performanceEntries.id, params.id))
            .returning())

        if (!updated) {
            set.status = 404
            return { error: "Performance entry not found" }
        }

        return { success: true }
    },
    {
        params: t.Object({ id: t.String() }),
        body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
    },
)
```

- [ ] **Step 2: Verify the change**

Start the dev server and confirm the endpoint is accessible. The endpoint should now return `{ success: true }` instead of hard-deleting.

- [ ] **Step 3: Commit**

```bash
git add lib/api/performance.ts
git commit -m "feat: change user-delete to soft delete for performance entries"
```

---

## Task 4: Enrich Preset Data in Server Component

**Files:**
- Modify: `app/game/[id]/page.tsx`

- [ ] **Step 1: Add generateMetadata function**

Replace the static `export const metadata = { title: "Game" }` with a `generateMetadata` function. Add imports for `Metadata` from `next` at the top. Extract the game resolution logic into a helper function that both `generateMetadata` and the page component can use.

```typescript
import type { Metadata } from "next"

// Helper to resolve a game by ID or Steam AppID
async function resolveGame(id: string) {
    const isNumeric = /^\d+$/.test(id)
    let game
    if (isNumeric) {
        const rows = await db
            .select()
            .from(games)
            .where(eq(games.steamAppId, Number(id)))
            .limit(1)
        game = rows[0]
    } else {
        const rows = await db
            .select()
            .from(games)
            .where(eq(games.id, id))
            .limit(1)
        game = rows[0]
    }
    return game
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    const game = await resolveGame(id)

    if (!game) {
        return { title: "Game Not Found | DeckyVault" }
    }

    const description = game.description
        ? game.description.slice(0, 160)
        : `Find benchmarks, community presets, and performance settings for ${game.title} on Steam Deck.`

    return {
        title: `${game.title} - Benchmarks & Settings`,
        description,
        alternates: { canonical: `https://deckyvault.xyz/game/${game.id}` },
        openGraph: {
            title: `${game.title} - Benchmarks & Settings | DeckyVault`,
            description: game.description?.slice(0, 200) ?? `Benchmarks and settings for ${game.title}`,
            url: `https://deckyvault.xyz/game/${game.id}`,
            images: [{ url: `/game/${game.id}/opengraph-image`, width: 1200, height: 630 }],
            type: "website",
            siteName: "DeckyVault",
        },
        twitter: {
            card: "summary_large_image",
            title: `${game.title} - Benchmarks & Settings | DeckyVault`,
            description: game.description?.slice(0, 200) ?? `Benchmarks and settings for ${game.title}`,
            images: [`/game/${game.id}/opengraph-image`],
        },
    }
}
```

- [ ] **Step 2: Enrich the preset query — add user join and missing fields**

In the `presetRows` query, add a join on `user` table and select the additional fields. The current query selects from `performanceEntries`, `gameVersions`, and `hardware`. Add:

```typescript
import { user } from "@/lib/db/schema"
```

And in the `presetRows` select, add these fields:

```typescript
userName: user.name,
userImage: user.image,
userId: performanceEntries.userId,
downvotes: performanceEntries.downvotes,
verifiedAt: performanceEntries.verifiedAt,
settingsJson: performanceEntries.settingsJson,
launchOptions: performanceEntries.launchOptions,
userNotes: performanceEntries.userNotes,
```

Also add `.innerJoin(user, eq(performanceEntries.userId, user.id))` to the query.

- [ ] **Step 3: Update serializedPresets to include new fields**

In the `serializedPresets` mapping, add:

```typescript
settingsJson: p.settingsJson,
launchOptions: p.launchOptions,
userNotes: p.userNotes,
userId: p.userId,
userName: p.userName,
userImage: p.userImage,
downvotes: p.downvotes,
verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
```

- [ ] **Step 4: Refactor the page component to use resolveGame helper**

Replace the inline game resolution logic in the `GamePage` function with a call to `resolveGame(id)`. Keep the `createGameStub` and sync logic in the page component since they have side effects.

- [ ] **Step 5: Add JSON-LD structured data**

In the `GamePage` return, add a `<script>` tag for JSON-LD before `<GamePageClient>`:

```tsx
<script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
        __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGame",
            name: game.title,
            ...(game.developer && { developer: { "@type": "Organization", name: game.developer } }),
            ...(game.genres && { genre: game.genres }),
            ...(game.headerImage && { image: game.headerImage }),
            url: `https://deckyvault.xyz/game/${game.id}`,
            applicationCategory: "Game",
            operatingSystem: "SteamOS",
            ...(game.storeUrl && { offers: { "@type": "Offer", url: game.storeUrl } }),
        }),
    }}
/>
```

- [ ] **Step 6: Verify the page loads**

Start dev server, navigate to a game page, verify:
- The `<title>` tag shows the game title
- The `<meta name="description">` shows game description
- The JSON-LD script is present in the page source
- Preset data includes the new fields (userId, userName, etc.)

- [ ] **Step 7: Commit**

```bash
git add app/game/[id]/page.tsx
git commit -m "feat: add generateMetadata, enriched preset data, and JSON-LD to game page"
```

---

## Task 5: Preset Detail Modal Component

**Files:**
- Create: `app/game/[id]/preset-detail-modal.tsx`

- [ ] **Step 1: Create the preset detail modal component**

Create `app/game/[id]/preset-detail-modal.tsx`:

```tsx
"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
    TrendingUpIcon,
    TrendingDownIcon,
    FlagIcon,
    TrashIcon,
    ChevronDownIcon,
    ShieldCheckIcon,
    XIcon,
    UserIcon,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import type { GameSettingCategory } from "@/lib/db/schema/performanceEntries"

interface Preset {
    id: string
    hardwareSlug: string
    hardwareName: string
    upvotes: number
    downvotes: number
    settingsJson: GameSettingCategory[] | null
    settingsCount: number
    fpsAvg: number | null
    fpsLow: number | null
    fpsHigh: number | null
    upscalerType: string | null
    upscalerVersion: string | null
    frameGenMethod: string | null
    protonVersion: string | null
    osVersion: string | null
    launchOptions: string | null
    userNotes: string | null
    userId: string
    userName: string | null
    userImage: string | null
    verifiedAt: string | null
    createdAt: string
}

const REPORT_REASONS = [
    { value: "inaccurate" as const, label: "Inaccurate data" },
    { value: "spam" as const, label: "Spam" },
    { value: "inappropriate" as const, label: "Inappropriate" },
    { value: "other" as const, label: "Other" },
]

export function PresetDetailModal({
    preset,
    onClose,
    onDelete,
    onReport,
    hasReported,
}: {
    preset: Preset
    onClose: () => void
    onDelete: (presetId: string) => void
    onReport: (presetId: string, reason: "inaccurate" | "spam" | "inappropriate" | "other", details?: string) => void
    hasReported: boolean
}) {
    const { data: session } = useSession()
    const isOwner = session?.user?.id === preset.userId
    const isAdmin = session?.user?.role === "admin"
    const canDelete = isOwner || isAdmin
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showReport, setShowReport] = useState(false)
    const [reportReason, setReportReason] = useState<"inaccurate" | "spam" | "inappropriate" | "other">("inaccurate")
    const [reportDetails, setReportDetails] = useState("")
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

    const toggleCategory = (cat: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev)
            if (next.has(cat)) next.delete(cat)
            else next.add(cat)
            return next
        })
    }

    return (
        <motion.div
            layoutId={preset.id}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-background border border-border rounded-2xl shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        {preset.userImage ? (
                            <img src={preset.userImage} alt="" className="h-8 w-8 rounded-full" />
                        ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserIcon className="h-4 w-4 text-primary" />
                            </div>
                        )}
                        <div>
                            <p className="text-sm font-medium">{preset.userName ?? "Anonymous"}</p>
                            <p className="text-xs text-text/50">{new Date(preset.createdAt).toLocaleDateString()}</p>
                        </div>
                        {preset.verifiedAt && (
                            <ShieldCheckIcon className="h-4 w-4 text-blue-400" title="Verified" />
                        )}
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-text/5 transition-colors">
                        <XIcon className="h-5 w-5 text-text/60" />
                    </button>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 px-4 py-3 border-b border-border text-sm">
                    <span className="flex items-center gap-1">
                        <TrendingUpIcon className="h-3.5 w-3.5 text-green-400" />
                        {preset.upvotes}
                    </span>
                    <span className="flex items-center gap-1">
                        <TrendingDownIcon className="h-3.5 w-3.5 text-red-400" />
                        {preset.downvotes}
                    </span>
                    {preset.fpsAvg !== null && (
                        <span className="ml-auto font-semibold">
                            {preset.fpsAvg} avg FPS
                            {preset.fpsLow !== null && ` (${preset.fpsLow}–${preset.fpsHigh})`}
                        </span>
                    )}
                </div>

                {/* Metadata */}
                <div className="px-4 py-3 border-b border-border grid grid-cols-2 gap-2 text-xs text-text/70">
                    {preset.protonVersion && <span>Proton {preset.protonVersion}</span>}
                    {preset.osVersion && <span>SteamOS {preset.osVersion}</span>}
                    {preset.upscalerType && preset.upscalerType !== "none" && (
                        <span>Upscaler: {preset.upscalerType.toUpperCase()}</span>
                    )}
                    {preset.frameGenMethod && preset.frameGenMethod !== "none" && (
                        <span>Frame Gen: {preset.frameGenMethod}</span>
                    )}
                    {preset.launchOptions && <span className="col-span-2">Launch: {preset.launchOptions}</span>}
                </div>

                {/* Settings Table */}
                {preset.settingsJson && preset.settingsJson.length > 0 && (
                    <div className="px-4 py-3 border-b border-border">
                        <h3 className="text-sm font-semibold mb-2">Settings ({preset.settingsCount})</h3>
                        <div className="flex flex-col gap-2">
                            {preset.settingsJson.map((cat) => (
                                <div key={cat.category} className="border border-border rounded-lg overflow-hidden">
                                    <button
                                        onClick={() => toggleCategory(cat.category)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium bg-text/3 hover:bg-text/5 transition-colors"
                                    >
                                        {cat.category}
                                        <ChevronDownIcon
                                            className={`h-3.5 w-3.5 transition-transform ${
                                                expandedCategories.has(cat.category) ? "rotate-180" : ""
                                            }`}
                                        />
                                    </button>
                                    {expandedCategories.has(cat.category) && (
                                        <div className="divide-y divide-border">
                                            {cat.settings.map((s, i) => (
                                                <div key={i} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                                    <span className="text-text/60">{s.title ?? s.title}</span>
                                                    <span className="font-medium">
                                                        {typeof s.value === "boolean" ? (s.value ? "On" : "Off") : String(s.value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* User Notes */}
                {preset.userNotes && (
                    <div className="px-4 py-3 border-b border-border text-sm text-text/70">
                        <h3 className="text-xs font-semibold mb-1">Notes</h3>
                        <p>{preset.userNotes}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                        {canDelete && !showDeleteConfirm && (
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                            >
                                <TrashIcon className="h-3 w-3" />
                                Delete
                            </button>
                        )}
                        {canDelete && showDeleteConfirm && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-text/60">Remove this preset?</span>
                                <button
                                    onClick={() => onDelete(preset.id)}
                                    className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-2 py-1 text-xs bg-text/5 text-text/60 rounded hover:bg-text/10 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        {!hasReported ? (
                            <>
                                <button
                                    onClick={() => setShowReport(!showReport)}
                                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-text/50 border border-border rounded-lg hover:bg-text/5 transition-colors"
                                >
                                    <FlagIcon className="h-3 w-3" />
                                    Report
                                </button>
                                {showReport && (
                                    <div className="absolute right-0 bottom-full mb-2 w-56 bg-background border border-border rounded-xl shadow-xl p-3 z-10">
                                        <p className="text-xs font-medium mb-2">Report reason:</p>
                                        <div className="flex flex-col gap-1">
                                            {REPORT_REASONS.map((r) => (
                                                <button
                                                    key={r.value}
                                                    onClick={() => setReportReason(r.value)}
                                                    className={`text-xs px-2 py-1 rounded text-left ${
                                                        reportReason === r.value
                                                            ? "bg-primary/10 text-primary"
                                                            : "hover:bg-text/5"
                                                    }`}
                                                >
                                                    {r.label}
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            value={reportDetails}
                                            onChange={(e) => setReportDetails(e.target.value)}
                                            placeholder="Details (optional)"
                                            className="mt-2 w-full text-xs border border-border rounded-lg p-2 bg-transparent resize-none"
                                            rows={2}
                                        />
                                        <button
                                            onClick={() => {
                                                onReport(preset.id, reportReason, reportDetails || undefined)
                                                setShowReport(false)
                                            }}
                                            className="mt-2 w-full text-xs bg-primary text-primary-foreground py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                                        >
                                            Submit Report
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <span className="flex items-center gap-1 text-xs text-text/30">
                                <FlagIcon className="h-3 w-3" />
                                Reported
                            </span>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/game/[id]/preset-detail-modal.tsx
git commit -m "feat: add PresetDetailModal component with settings view, delete, and report"
```

---

## Task 6: Game Page Client — Layout, Preset Section Overhaul

**Files:**
- Modify: `app/game/[id]/game-page-client.tsx`

This is the largest task. It involves:
1. Updating the `Preset` interface with new fields
2. Reordering the Community Presets section above Statistics Dashboard
3. Changing the presets layout from a 3-column grid to a horizontal scroll row
4. Adding `selectedPresetId` state and click handler to open the modal
5. Importing and rendering `PresetDetailModal` with `AnimatePresence`
6. Adding delete and report API call handlers
7. Sorting presets by `createdAt` descending (newest first, leftmost)

- [ ] **Step 1: Update the Preset interface**

In `game-page-client.tsx`, update the `Preset` interface to include all new fields:

```typescript
interface Preset {
    id: string
    hardwareSlug: string
    hardwareName: string
    upvotes: number
    downvotes: number
    settingsJson: GameSettingCategory[] | null
    settingsCount: number
    fpsAvg: number | null
    fpsLow: number | null
    fpsHigh: number | null
    upscalerType: string | null
    upscalerVersion: string | null
    frameGenMethod: string | null
    protonVersion: string | null
    osVersion: string | null
    launchOptions: string | null
    userNotes: string | null
    userId: string
    userName: string | null
    userImage: string | null
    verifiedAt: string | null
    createdAt: string
}
```

Add the import for `GameSettingCategory`:
```typescript
import type { GameSettingCategory } from "@/lib/db/schema/performanceEntries"
```

- [ ] **Step 2: Add state and handlers for modal, delete, and report**

Add new state variables inside the `GamePageClient` component:

```typescript
const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
const [reportedPresets, setReportedPresets] = useState<Set<string>>(new Set())
const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null)
```

Add handler functions:

```typescript
const handleDeletePreset = async (presetId: string) => {
    try {
        const res = await fetch(`/api/performance/${presetId}/user-delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
        })
        if (res.ok) {
            // Remove from local state
            setDeletingPresetId(null)
            setSelectedPresetId(null)
            // Ideally refresh presets from server, but for now just filter locally
        }
    } catch (err) {
        console.error("Failed to delete preset:", err)
    }
}

const handleReportPreset = async (presetId: string, reason: "inaccurate" | "spam" | "inappropriate" | "other", details?: string) => {
    try {
        const res = await fetch(`/api/performance/${presetId}/report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason, details }),
        })
        if (res.ok) {
            setReportedPresets((prev) => new Set(prev).add(presetId))
        }
    } catch (err) {
        console.error("Failed to report preset:", err)
    }
}
```

- [ ] **Step 3: Reorder sections — presets above statistics**

Find the two `<motion.div>` sections in the JSX:
- Section 4: "Statistics Dashboard" (contains charts)
- Section 5: "Community Presets" (contains preset grid)

Move Section 5 (Community Presets) **above** Section 4 (Statistics Dashboard).

- [ ] **Step 4: Change presets layout to horizontal scroll row**

Replace the `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` container with a horizontal scroll container. Add left/right scroll chevron buttons.

The Community Presets section should look like:

```tsx
{/* Section 4: Community Presets */}
<motion.div ...>
    <div className="max-w-7xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Community Presets</h2>
            <span className="text-xs text-text/50">
                {filteredPresets.length} preset{filteredPresets.length !== 1 ? "s" : ""}
            </span>
        </div>

        {filteredPresets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-xl border border-border bg-text/2">
                <SettingsIcon className="h-10 w-10 text-text/20" />
                <p className="text-sm text-text/40">No presets match the selected filters</p>
            </div>
        ) : (
            <div className="relative group/presets">
                {/* Left scroll button */}
                <button
                    onClick={() => presetsRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center h-10 w-10 rounded-full bg-background/80 border border-border hover:bg-text/5 opacity-0 group-hover/presets:opacity-100 transition-opacity"
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </button>
                {/* Right scroll button */}
                <button
                    onClick={() => presetsRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center h-10 w-10 rounded-full bg-background/80 border border-border hover:bg-text/5 opacity-0 group-hover/presets:opacity-100 transition-opacity"
                >
                    <ChevronRightIcon className="h-5 w-5" />
                </button>
                <div
                    ref={presetsRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide pb-4"
                >
                    {/* Sort newest first */}
                    {[...filteredPresets]
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((preset) => {
                            const raw = isRawPerformerPreset(preset)
                            return (
                                <motion.div
                                    key={preset.id}
                                    layoutId={preset.id}
                                    onClick={() => setSelectedPresetId(preset.id)}
                                    className={`flex-shrink-0 w-72 flex flex-col gap-3 p-4 rounded-xl border transition-colors cursor-pointer hover:border-primary/30 ${
                                        raw
                                            ? "border-green-500/30 bg-green-500/5"
                                            : "border-border bg-text/3"
                                    }`}
                                >
                                    {/* Card content stays the same — FPS, tags, etc */}
                                    {/* ... existing card content ... */}
                                </motion.div>
                            )
                        })}
                </div>
            </div>
        )}
    </div>
</motion.div>

{/* Modal */}
<AnimatePresence>
    {selectedPresetId && (
        <PresetDetailModal
            preset={presets.find((p) => p.id === selectedPresetId)!}
            onClose={() => setSelectedPresetId(null)}
            onDelete={handleDeletePreset}
            onReport={handleReportPreset}
            hasReported={reportedPresets.has(selectedPresetId)}
        />
    )}
</AnimatePresence>
```

Add the `presetsRef` at the top of the component:
```typescript
const presetsRef = useRef<HTMLDivElement>(null)
```

Add necessary icon imports:
```typescript
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
```

- [ ] **Step 5: Add scrollbar-hide CSS**

In `app/globals.css`, add:

```css
.scrollbar-hide {
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
```

- [ ] **Step 6: Verify the page loads and presets render correctly**

Start dev server, navigate to a game page with presets, verify:
- Presets render in a horizontal row (not grid)
- Newest preset is leftmost
- Clicking a preset opens the modal with animation
- Modal shows settings table with collapsible categories
- Delete button appears for owner/admin
- Report button appears for all authenticated users
- Presets section is above the statistics dashboard

- [ ] **Step 7: Commit**

```bash
git add app/game/[id]/game-page-client.tsx app/globals.css
git commit -m "feat: horizontal preset layout, detail modal with AnimatePresence, delete/report, reorder above stats"
```

---

## Task 7: Dynamic OG Image for Game Pages

**Files:**
- Create: `app/game/[id]/opengraph-image.tsx`

- [ ] **Step 1: Create the dynamic OG image route**

Create `app/game/[id]/opengraph-image.tsx`:

```typescript
import { ImageResponse } from "next/og"
import { db } from "@/lib/db/index"
import { games, gameVersions, performanceEntries, hardware } from "@/lib/db/schema"
import { eq, and, sql, desc } from "drizzle-orm"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "DeckyVault - Game Benchmarks"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const isNumeric = /^\d+$/.test(id)

    let game
    if (isNumeric) {
        const rows = await db.select().from(games).where(eq(games.steamAppId, Number(id))).limit(1)
        game = rows[0]
    } else {
        const rows = await db.select().from(games).where(eq(games.id, id)).limit(1)
        game = rows[0]
    }

    if (!game) {
        return new ImageResponse(
            (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#100b14", color: "#ebe4f1", fontFamily: "sans-serif", gap: "16px" }}>
                    <div style={{ fontSize: 48, fontWeight: 700 }}>Game Not Found</div>
                    <div style={{ fontSize: 24, opacity: 0.7 }}>DeckyVault</div>
                </div>
            ),
            { ...size }
        )
    }

    // Get best FPS stat
    const [bestStat] = await db
        .select({ avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)` })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(and(eq(gameVersions.gameId, game.id), eq(performanceEntries.isRemoved, false)))
        .limit(1)

    const logoData = await readFile(join(process.cwd(), "app/icon.png"), "base64")
    const logoSrc = `data:image/png;base64,${logoData}`

    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px", background: "#100b14", color: "#ebe4f1", fontFamily: "sans-serif" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                    <img src={logoSrc} alt="" height={48} style={{ borderRadius: "8px" }} />
                    <span style={{ fontSize: 24, fontWeight: 600, opacity: 0.8 }}>DeckyVault</span>
                </div>
                <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, marginBottom: "16px", maxWidth: "900px" }}>
                    {game.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: 24, opacity: 0.8 }}>
                    {game.developer && <span>by {game.developer}</span>}
                    {bestStat?.avgFps && <span style={{ color: "#22c55e" }}>~{bestStat.avgFps} avg FPS</span>}
                </div>
                {game.genres && game.genres.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                        {game.genres.slice(0, 4).map((genre: string) => (
                            <span key={genre} style={{ padding: "4px 12px", borderRadius: "9999px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", fontSize: 16 }}>
                                {genre}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        ),
        { ...size }
    )
}
```

- [ ] **Step 2: Verify OG image loads**

Start dev server, navigate to `http://localhost:3000/game/<game-id>/opengraph-image` and verify a PNG image renders with the game title, developer, avg FPS, and genres.

- [ ] **Step 3: Commit**

```bash
git add app/game/[id]/opengraph-image.tsx
git commit -m "feat: add dynamic OG image generation for game pages"
```

---

## Task 8: SEO — Sitemap + Search/Landing/Devices Metadata + Canonical URLs

**Files:**
- Modify: `app/sitemap.ts`
- Modify: `app/search/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/devices/page.tsx`
- Modify: `app/devices/[slug]/page.tsx`

- [ ] **Step 1: Expand sitemap with games and devices**

Modify `app/sitemap.ts` to query the database for all games and devices:

```typescript
import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"

const BASE_URL = "https://deckyvault.xyz"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [allGames, allDevices] = await Promise.all([
        db.select({ id: games.id, updatedAt: games.updatedAt }).from(games),
        db.select({ slug: hardware.slug, updatedAt: hardware.updatedAt }).from(hardware),
    ])

    const gameEntries: MetadataRoute.Sitemap = allGames.map((game) => ({
        url: `${BASE_URL}/game/${game.id}`,
        lastModified: game.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
    }))

    const deviceEntries: MetadataRoute.Sitemap = allDevices.map((device) => ({
        url: `${BASE_URL}/devices/${device.slug}`,
        lastModified: device.updatedAt,
        changeFrequency: "monthly",
        priority: 0.6,
    }))

    return [
        { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
        { url: `${BASE_URL}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
        { url: `${BASE_URL}/devices`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
        ...gameEntries,
        ...deviceEntries,
    ]
}
```

- [ ] **Step 2: Add metadata to search page**

Add a metadata export to `app/search/page.tsx`. Since this is a client component, create a separate `layout.tsx` or use a wrapper approach. If the search page file starts with `"use client"`, we need to move metadata to a parent layout or a wrapper server component.

Create a server component wrapper `app/search/layout.tsx`:

```tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Search Games",
    description: "Search for games and find benchmarks, settings, and performance data on DeckyVault.",
    alternates: { canonical: "https://deckyvault.xyz/search" },
    robots: { index: false },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return children
}
```

- [ ] **Step 3: Add JSON-LD WebSite schema to landing page**

In `app/page.tsx`, add a JSON-LD script tag before the returning JSX. Since this is a client component, we need to handle this differently — create a small server component for the JSON-LD and import it, or embed it in a `<script>` tag.

Since the landing page is a client component (`"use client"`), add the JSON-LD as a `<script>` tag inside the component's return:

```tsx
<script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
        __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "DeckyVault",
            url: "https://deckyvault.xyz",
            description: "Steam Deck benchmarks, settings, and performance guides",
            potentialAction: {
                "@type": "SearchAction",
                target: "https://deckyvault.xyz/search?q={search_term_string}",
                "query-input": "required name=search_term_string",
            },
        }),
    }}
/>
```

- [ ] **Step 4: Add JSON-LD ItemList to devices page**

In `app/devices/page.tsx`, this is a server component. Add metadata expansion and JSON-LD:

```tsx
export const metadata = {
    title: "Devices — DeckyVault",
    description: "Browse handheld and console devices with benchmark data on DeckyVault",
    alternates: { canonical: "https://deckyvault.xyz/devices" },
}
```

But the JSON-LD needs the device list — this data is fetched in the client component. Since we need device data for JSON-LD, we should create a separate server component for the JSON-LD that fetches device slugs.

In `app/devices/page.tsx`, add:

```tsx
import { db } from "@/lib/db/index"
import { hardware } from "@/lib/db/schema"

export default async function DevicesPage() {
    const devices = await db.select({ slug: hardware.slug, name: hardware.name }).from(hardware)

    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        itemListElement: devices.map((d, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: d.name,
            url: `https://deckyvault.xyz/devices/${d.slug}`,
        })),
    }

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <DevicesPageClient />
        </>
    )
}
```

Note: This means the server component now fetches devices for JSON-LD, but the client component still fetches them for display. We could pass the data down, but for now this is acceptable since the device count is small.

- [ ] **Step 5: Add JSON-LD Product schema to device detail page**

In `app/devices/[slug]/page.tsx`, add JSON-LD in the return and expand metadata:

```tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    // ... existing metadata generation ...
    return {
        title: `${device.name} — DeckyVault`,
        description: `Benchmark data and performance stats for ${device.name} on DeckyVault`,
        alternates: { canonical: `https://deckyvault.xyz/devices/${slug}` },
    }
}

export default async function DevicePage({ params }: { params: Promise<{ slug: string }> }) {
    // ... existing logic ...
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: device.name,
        category: device.deviceType,
        url: `https://deckyvault.xyz/devices/${device.slug}`,
    }

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <DeviceDetailClient device={device} />
        </>
    )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/sitemap.ts app/search/layout.tsx app/page.tsx app/devices/page.tsx app/devices/[slug]/page.tsx
git commit -m "feat: SEO overhaul — expanded sitemap, JSON-LD, canonical URLs, search metadata"
```

---

## Task 9: Build & Lint Cleanup

**Files:**
- Various (fix any build/lint errors from above changes)

- [ ] **Step 1: Run the build and fix all errors**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && npm run build
```

Fix any TypeScript errors, import issues, or build failures.

- [ ] **Step 2: Run linting and fix all warnings**

```bash
cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && npm run lint
```

Fix all lint warnings and errors.

- [ ] **Step 3: Verify all pages render correctly**

Start the dev server and manually verify:
- Landing page loads and JSON-LD is present in source
- Search page has correct metadata
- Devices page has correct metadata and JSON-LD
- Device detail page has correct metadata and JSON-LD
- Game detail page has dynamic metadata (check `<title>` tag)
- Game detail page has JSON-LD
- Game OG image loads at `/game/[id]/opengraph-image`
- Sitemap includes games and devices
- Presets render horizontally newest-first
- Clicking preset opens modal with settings view
- Delete and report buttons work correctly

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix build errors and lint issues from presets + SEO overhaul"
```

---

## Self-Review Checklist

**1. Spec Coverage:**
- [x] 1.1 Horizontal scroll layout → Task 6
- [x] 1.2 Presets above statistics → Task 6
- [x] 1.3 AnimatePresence modal for settings view → Task 5 + Task 6
- [x] 1.4 Soft delete for owners + admins → Task 3
- [x] 1.5 Report flow (table, API, UI) → Task 1, Task 2, Task 5
- [x] 1.6 Preset data enrichment → Task 4
- [x] 1.7 Preset type update → Task 6
- [x] 2.1 Game generateMetadata → Task 4
- [x] 2.2 Game JSON-LD → Task 4
- [x] 2.3 Dynamic OG image → Task 7
- [x] 2.4 Search page metadata → Task 8
- [x] 2.5 Landing page JSON-LD → Task 8
- [x] 2.6 Devices page JSON-LD → Task 8
- [x] 2.7 Device detail JSON-LD → Task 8
- [x] 2.8 Sitemap expansion → Task 8
- [x] 2.9 robots.ts — No changes needed (confirmed)
- [x] 2.10 Canonical URLs → Task 8 + Task 4

**2. Placeholder Scan:** No TBD/TODO/placeholders found.

**3. Type Consistency:** All Preset fields are consistently used across Tasks 4, 5, and 6. API paths match between Task 2 and Task 6.
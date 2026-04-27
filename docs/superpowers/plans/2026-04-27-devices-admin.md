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

---

### Task 4: Redesign Devices List Page

**Files:**
- Modify: `app/devices/page.tsx`
- Modify: `app/devices/page-client.tsx`

- [ ] **Step 1: Rewrite the server component to fetch data and pass as props**

Replace the entire content of `app/devices/page.tsx` with:

```tsx
import { db } from "@/lib/db/index"
import { hardware, performanceEntries, gameVersions, games } from "@/lib/db/schema"
import { eq, and, sql, desc } from "drizzle-orm"
import { DevicesPageClient } from "./page-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Devices — DeckyVault",
  description:
    "Browse benchmark data for handheld and console gaming devices. Compare FPS, performance stats, and community benchmarks on DeckyVault.",
  keywords: ["steam deck", "handheld", "console", "benchmarks", "FPS", "performance", "devices"],
  alternates: { canonical: "https://deckyvault.xyz/devices" },
  openGraph: {
    title: "Devices — DeckyVault",
    description:
      "Browse benchmark data for handheld and console gaming devices on DeckyVault.",
    url: "https://deckyvault.xyz/devices",
    siteName: "DeckyVault",
    type: "website",
  },
}

export default async function DevicesPage() {
  // Fetch all hardware devices ordered by sortOrder
  const deviceRows = await db
    .select({
      slug: hardware.slug,
      name: hardware.name,
      deviceType: hardware.deviceType,
      image: hardware.image,
      sortOrder: hardware.sortOrder,
    })
    .from(hardware)
    .orderBy(hardware.sortOrder)

  // Get aggregated stats per device
  const statsPerDevice = await db
    .select({
      hardwareSlug: performanceEntries.hardwareSlug,
      totalBenchmarks: sql<number>`count(*)::int`,
      avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
      verifiedCount: sql<number>`count(*) filter (where ${performanceEntries.verifiedAt} is not null)::int`,
      gameCount: sql<number>`count(distinct ${gameVersions.gameId})::int`,
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .innerJoin(games, eq(gameVersions.gameId, games.id))
    .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
    .where(eq(performanceEntries.isRemoved, false))
    .groupBy(performanceEntries.hardwareSlug)

  const statsMap = new Map(statsPerDevice.map((s) => [s.hardwareSlug, s]))

  // Best game per device (highest avg FPS)
  const bestGames = await db
    .select({
      hardwareSlug: performanceEntries.hardwareSlug,
      gameId: games.id,
      gameTitle: games.title,
      gameHeaderImage: games.headerImage,
      fpsAvg: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .innerJoin(games, eq(gameVersions.gameId, games.id))
    .where(eq(performanceEntries.isRemoved, false))
    .groupBy(
      performanceEntries.hardwareSlug,
      games.id,
      games.title,
      games.headerImage,
    )
    .orderBy(desc(sql`avg(${performanceEntries.fpsAvg})`))

  const bestGameMap = new Map<
    string,
    { id: string; title: string; headerImage: string | null; fpsAvg: number }
  >()
  for (const bg of bestGames) {
    if (!bestGameMap.has(bg.hardwareSlug)) {
      bestGameMap.set(bg.hardwareSlug, {
        id: bg.gameId,
        title: bg.gameTitle,
        headerImage: bg.gameHeaderImage,
        fpsAvg: Number(bg.fpsAvg),
      })
    }
  }

  // Build device data with stats
  const devices = deviceRows.map((device, index) => {
    const stats = statsMap.get(device.slug)
    const bestGame = bestGameMap.get(device.slug)
    return {
      slug: device.slug,
      name: device.name,
      deviceType: device.deviceType,
      image: device.image,
      sortOrder: device.sortOrder,
      colorIndex: index,
      totalBenchmarks: stats?.totalBenchmarks ?? 0,
      avgFps: stats?.avgFps ? Number(stats.avgFps) : null,
      gameCount: stats?.gameCount ?? 0,
      verifiedCount: stats?.verifiedCount ?? 0,
      bestGame: bestGame ?? null,
    }
  })

  // JSON-LD structured data
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DevicesPageClient devices={devices} />
    </>
  )
}
```

- [ ] **Step 2: Rewrite the client component with filter tabs and enhanced cards**

Replace the entire content of `app/devices/page-client.tsx` with:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import {
  Gamepad2Icon,
  TrendingUpIcon,
  DatabaseIcon,
  ArrowRightIcon,
  MonitorIcon,
  CheckCircleIcon,
} from "lucide-react"
import { getDeviceColor } from "@/components/charts/EChartWrapper"

export interface DeviceStats {
  slug: string
  name: string
  deviceType: string
  image: string | null
  sortOrder: number
  colorIndex: number
  totalBenchmarks: number
  avgFps: number | null
  gameCount: number
  verifiedCount: number
  bestGame: {
    id: string
    title: string
    headerImage: string | null
    fpsAvg: number
  } | null
}

const deviceTypeLabel: Record<string, string> = {
  handheld: "Handheld",
  console: "Console",
}

const deviceTypeColor: Record<string, string> = {
  handheld: "text-primary bg-primary/10 border-primary/20",
  console: "text-secondary bg-secondary/10 border-secondary/20",
}

type FilterType = "all" | "handheld" | "console"

const filterOptions: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "handheld", label: "Handheld" },
  { id: "console", label: "Console" },
]

export function DevicesPageClient({ devices }: { devices: DeviceStats[] }) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")

  const filteredDevices =
    activeFilter === "all"
      ? devices
      : devices.filter((d) => d.deviceType === activeFilter)

  if (devices.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-[10svw] py-8">
        <div className="text-center py-16 text-text/40">
          <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
          <p>No devices found</p>
          <p className="text-sm mt-1">
            Benchmark data will appear as devices are added
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">Devices</h1>
          <p className="text-sm text-text/60 mt-1">
            Browse benchmark data for handheld and console devices
          </p>
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setActiveFilter(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeFilter === opt.id
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-text/50 hover:text-text/70 hover:bg-text/5 border border-transparent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Device Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device, i) => (
            <motion.div
              key={device.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: Math.min(0.05 * i, 0.5),
              }}
            >
              <Link
                href={`/devices/${device.slug}`}
                className="block rounded-xl border border-border bg-text/[0.03] hover:border-primary/30 transition-colors group overflow-hidden"
              >
                {/* Image / Icon Header */}
                <div
                  className="relative h-28 flex items-center justify-center"
                  style={{
                    background: `${getDeviceColor(device.colorIndex)}08`,
                  }}
                >
                  {device.image ? (
                    <Image
                      src={device.image}
                      alt={device.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <Gamepad2Icon
                      className="h-12 w-12"
                      style={{
                        color: getDeviceColor(device.colorIndex),
                        opacity: 0.6,
                      }}
                    />
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5">
                  {/* Name & Type */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                        {device.name}
                      </h2>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize mt-1 ${
                          deviceTypeColor[device.deviceType] ||
                          "text-text/50 bg-text/5 border-border"
                        }`}
                      >
                        <Gamepad2Icon className="h-2.5 w-2.5" />
                        {deviceTypeLabel[device.deviceType] ||
                          device.deviceType}
                      </span>
                    </div>
                    <ArrowRightIcon className="h-5 w-5 text-text/20 group-hover:text-primary transition-colors" />
                  </div>

                  {/* Stats Row — 4 columns */}
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    <div className="flex flex-col items-center text-center">
                      <DatabaseIcon className="h-3.5 w-3.5 text-primary mb-1" />
                      <span className="text-base font-bold tabular-nums">
                        {device.totalBenchmarks}
                      </span>
                      <span className="text-[9px] text-text/50">
                        Benchmarks
                      </span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <TrendingUpIcon className="h-3.5 w-3.5 text-green-400 mb-1" />
                      <span className="text-base font-bold tabular-nums">
                        {device.avgFps !== null ? device.avgFps : "—"}
                      </span>
                      <span className="text-[9px] text-text/50">Avg FPS</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <MonitorIcon className="h-3.5 w-3.5 text-accent mb-1" />
                      <span className="text-base font-bold tabular-nums">
                        {device.gameCount}
                      </span>
                      <span className="text-[9px] text-text/50">Games</span>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-blue-400 mb-1" />
                      <span className="text-base font-bold tabular-nums">
                        {device.verifiedCount}
                      </span>
                      <span className="text-[9px] text-text/50">Verified</span>
                    </div>
                  </div>

                  {/* Best game */}
                  {device.bestGame && (
                    <div className="mt-3 pt-3 border-t border-border text-xs text-text/50">
                      Top:{" "}
                      <span className="text-text/80 font-medium">
                        {device.bestGame.title}
                      </span>{" "}
                      · {device.bestGame.fpsAvg} FPS
                    </div>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* No results for filter */}
        {filteredDevices.length === 0 && devices.length > 0 && (
          <div className="text-center py-12 text-text/40">
            <Gamepad2Icon className="h-8 w-8 mx-auto mb-2" />
            <p>No {activeFilter} devices found</p>
          </div>
        )}
      </motion.div>
    </section>
  )
}
```

- [ ] **Step 3: Verify the page renders correctly**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run build --no-lint 2>&1 | tail -20`
Expected: Build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/devices/page.tsx app/devices/page-client.tsx
git commit -m "feat: redesign devices list page with filter tabs, image/icon, verified stats

- Server component fetches data and passes as props (RSC pattern)
- Add device-type filter pills (All/Handheld/Console)
- Add device image with icon fallback
- Add verified count to stats row
- Fix deviceTypeLabel to use 'handheld' key
- Cap stagger animation delay at 0.5s
- Enhanced SEO metadata with keywords and OpenGraph"
```

---

### Task 5: Redesign Device Detail Page

**Files:**
- Modify: `app/devices/[slug]/page.tsx`
- Modify: `app/devices/[slug]/device-detail-client.tsx`

- [ ] **Step 1: Rewrite the server component with server-side data fetching and enhanced metadata**

Replace the entire content of `app/devices/[slug]/page.tsx` with:

```tsx
import { db } from "@/lib/db/index"
import { hardware, performanceEntries, gameVersions, games } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import { DeviceDetailClient } from "./device-detail-client"
import type { Metadata } from "next"

export const revalidate = 3600 // ISR: revalidate every hour

export async function generateStaticParams() {
  const devices = await db
    .select({ slug: hardware.slug })
    .from(hardware)
  return devices.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const [device] = await db
    .select({
      name: hardware.name,
      deviceType: hardware.deviceType,
    })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) return { title: "Device Not Found — DeckyVault" }

  const typeLabel = device.deviceType === "handheld" ? "Handheld" : "Console"

  return {
    title: `${device.name} — DeckyVault`,
    description: `Benchmark data, FPS stats, and performance analysis for the ${device.name} (${typeLabel}) on DeckyVault.`,
    keywords: [
      device.name.toLowerCase(),
      device.deviceType,
      "benchmarks",
      "FPS",
      "performance",
      "steam deck",
    ],
    alternates: { canonical: `https://deckyvault.xyz/devices/${slug}` },
    openGraph: {
      title: `${device.name} — DeckyVault`,
      description: `Benchmark data and performance stats for ${device.name} on DeckyVault.`,
      url: `https://deckyvault.xyz/devices/${slug}`,
      siteName: "DeckyVault",
      type: "website",
      images: [
        {
          url: `/devices/${slug}/opengraph-image`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${device.name} — DeckyVault`,
      description: `Benchmark data and performance stats for ${device.name} on DeckyVault.`,
      images: [`/devices/${slug}/opengraph-image`],
    },
  }
}

export default async function DevicePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [device] = await db
    .select({
      slug: hardware.slug,
      name: hardware.name,
      deviceType: hardware.deviceType,
      image: hardware.image,
    })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) {
    notFound()
  }

  // Count device index for color assignment (same order as list page)
  const allDevices = await db
    .select({ slug: hardware.slug })
    .from(hardware)
    .orderBy(hardware.sortOrder)
  const deviceColorIndex = allDevices.findIndex((d) => d.slug === slug)

  // JSON-LD
  const typeLabel = device.deviceType === "handheld" ? "Handheld" : "Console"
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: device.name,
    category: typeLabel,
    url: `https://deckyvault.xyz/devices/${device.slug}`,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DeviceDetailClient
        device={{
          slug: device.slug,
          name: device.name,
          deviceType: device.deviceType,
          image: device.image,
          colorIndex: deviceColorIndex,
        }}
      />
    </>
  )
}
```

- [ ] **Step 2: Rewrite the client component with fixes and improved layout**

Replace the entire content of `app/devices/[slug]/device-detail-client.tsx` with:

```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import {
  Gamepad2Icon,
  TrendingUpIcon,
  DatabaseIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  Loader2,
  RefreshCwIcon,
  MonitorIcon,
} from "lucide-react"
import {
  EChartWrapper,
  CHART_THEME,
  getDeviceColor,
} from "@/components/charts/EChartWrapper"
import type { EChartsOption } from "echarts"

interface DeviceInfo {
  slug: string
  name: string
  deviceType: string
  image: string | null
  colorIndex: number
}

interface UpscalerEntry {
  upscalerType: string
  count: number
  avgFps: number
}

interface DeviceStats {
  slug: string
  name: string
  deviceType: string
  totalBenchmarks: number
  avgFps: number | null
  verifiedCount: number
  gameCount: number
  boxplot: Array<{
    gameId: string
    gameTitle: string
    min: number
    q1: number
    median: number
    q3: number
    max: number
    count: number
  }>
  historical: Array<{
    period: string
    avgFps: number
    count: number
  }>
  topGames: Array<{
    gameId: string
    gameTitle: string
    headerImage: string | null
    avgFps: number
    benchmarkCount: number
  }>
  genreBreakdown: Array<{ genre: string; count: number }>
  protonBreakdown: Array<{ version: string; count: number }>
  upscalerBreakdown: UpscalerEntry[]
}

const deviceTypeLabel: Record<string, string> = {
  handheld: "Handheld",
  console: "Console",
}

const deviceTypeColor: Record<string, string> = {
  handheld: "text-primary bg-primary/10 border-primary/20",
  console: "text-secondary bg-secondary/10 border-secondary/20",
}

export function DeviceDetailClient({ device }: { device: DeviceInfo }) {
  const [stats, setStats] = useState<DeviceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const deviceColor = getDeviceColor(device.colorIndex)

  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hardware/${device.slug}/stats`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error("Failed to fetch device stats:", err)
      setError("Failed to load device statistics. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [device.slug])

  // ── Chart Options ──────────────────────────────────────────
  const historicalOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.historical.length === 0) return {}
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1a1020",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: "category",
        data: stats.historical.map((h) => h.period),
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        splitLine: {
          lineStyle: { color: CHART_THEME.border, opacity: 0.3 },
        },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      series: [
        {
          type: "line",
          data: stats.historical.map((h) => h.avgFps),
          smooth: true,
          lineStyle: { color: deviceColor, width: 2 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: deviceColor + "40" },
                { offset: 1, color: deviceColor + "05" },
              ],
            },
          },
          symbol: "circle",
          symbolSize: 4,
          itemStyle: { color: deviceColor },
        },
      ],
    }
  }, [stats, deviceColor])

  const boxplotOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.boxplot.length === 0) return {}
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1020",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      grid: { left: 80, right: 20, top: 10, bottom: 40 },
      xAxis: {
        type: "category",
        data: stats.boxplot.map((b) => b.gameTitle),
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        axisLabel: {
          color: CHART_THEME.textMuted,
          fontSize: 10,
          rotate: 30,
        },
      },
      yAxis: {
        type: "value",
        name: "FPS",
        axisLine: { lineStyle: { color: CHART_THEME.border } },
        splitLine: {
          lineStyle: { color: CHART_THEME.border, opacity: 0.3 },
        },
        axisLabel: { color: CHART_THEME.textMuted, fontSize: 11 },
        nameTextStyle: { color: CHART_THEME.textMuted, fontSize: 11 },
      },
      series: [
        {
          type: "boxplot",
          data: stats.boxplot.map((b) => [b.min, b.q1, b.median, b.q3, b.max]),
          itemStyle: {
            color: deviceColor + "30",
            borderColor: deviceColor,
          },
        },
      ],
    }
  }, [stats, deviceColor])

  const genreOption = useMemo<EChartsOption>(() => {
    if (!stats || stats.genreBreakdown.length === 0) return {}
    return {
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1025",
        borderColor: CHART_THEME.border,
        textStyle: { color: CHART_THEME.text },
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          center: ["50%", "50%"],
          data: stats.genreBreakdown.map((g, i) => ({
            name: g.genre,
            value: g.count,
            itemStyle: {
              color:
                CHART_THEME.deviceColors[
                  i % CHART_THEME.deviceColors.length
                ],
            },
          })),
          label: {
            color: CHART_THEME.textMuted,
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0,0,0,0.5)",
            },
          },
        },
      ],
    }
  }, [stats])

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* ── Hero Header ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            {/* Device Image or Icon */}
            <div
              className="flex items-center justify-center h-14 w-14 rounded-xl shrink-0"
              style={{ background: `${deviceColor}15` }}
            >
              {device.image ? (
                <Image
                  src={device.image}
                  alt={device.name}
                  width={56}
                  height={56}
                  className="object-contain"
                />
              ) : (
                <Gamepad2Icon
                  className="h-7 w-7"
                  style={{ color: deviceColor }}
                />
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {device.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${
                    deviceTypeColor[device.deviceType] ||
                    "text-text/50 bg-text/5 border-border"
                  }`}
                >
                  <Gamepad2Icon className="h-3 w-3" />
                  {deviceTypeLabel[device.deviceType] || device.deviceType}
                </span>
                {stats && stats.verifiedCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <CheckCircleIcon className="h-3 w-3" />
                    {stats.verifiedCount} verified
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-text/60">
            Performance benchmarks and statistics
          </p>
        </div>
      </motion.div>

      {/* ── Overview Stats ────────────────────────────────── */}
      {stats && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4">
            <StatCard
              icon={DatabaseIcon}
              label="Total Benchmarks"
              value={String(stats.totalBenchmarks)}
            />
            <StatCard
              icon={TrendingUpIcon}
              label="Average FPS"
              value={
                stats.avgFps !== null ? String(stats.avgFps) : "—"
              }
            />
            <StatCard
              icon={MonitorIcon}
              label="Games Tested"
              value={String(stats.gameCount)}
            />
            <StatCard
              icon={CheckCircleIcon}
              label="Verified"
              value={String(stats.verifiedCount)}
            />
          </div>
        </motion.div>
      )}

      {/* ── Loading State ─────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* ── Error State ───────────────────────────────────── */}
      {error && !loading && (
        <div className="px-4 md:px-[10svw]">
          <div className="max-w-7xl mx-auto text-center py-16 text-text/40">
            <Gamepad2Icon className="h-10 w-10 mx-auto mb-3" />
            <p className="text-text/60 mb-4">{error}</p>
            <button
              onClick={fetchStats}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <RefreshCwIcon className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Charts Section ────────────────────────────────── */}
      {stats && !loading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="px-4 md:px-[10svw]"
        >
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            {/* Row 1: Historical FPS */}
            {stats.historical.length > 0 && (
              <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                <h3 className="text-sm font-medium text-text/80 mb-2">
                  Historical Performance
                </h3>
                <EChartWrapper option={historicalOption} height={280} />
              </div>
            )}

            {/* Row 2: FPS Distribution + Genre Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {stats.boxplot.length > 0 && (
                <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                  <h3 className="text-sm font-medium text-text/80 mb-2">
                    FPS Distribution by Game
                  </h3>
                  <EChartWrapper option={boxplotOption} height={300} />
                </div>
              )}
              {stats.genreBreakdown.length > 0 && (
                <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                  <h3 className="text-sm font-medium text-text/80 mb-2">
                    Genre Breakdown
                  </h3>
                  <EChartWrapper option={genreOption} height={300} />
                </div>
              )}
            </div>

            {/* Row 3: Proton & Upscaler Breakdown */}
            {(stats.protonBreakdown.length > 0 ||
              stats.upscalerBreakdown.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {stats.protonBreakdown.length > 0 && (
                  <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                    <h3 className="text-sm font-medium text-text/80 mb-3">
                      Proton Version Distribution
                    </h3>
                    <div className="space-y-2">
                      {stats.protonBreakdown.map((p) => (
                        <div
                          key={p.version}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-text/70">{p.version}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-1.5 rounded-full bg-text/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{
                                  width: `${Math.max(
                                    5,
                                    (p.count / stats.totalBenchmarks) * 100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-text/50 text-xs">
                              {p.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {stats.upscalerBreakdown.length > 0 && (
                  <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                    <h3 className="text-sm font-medium text-text/80 mb-3">
                      Upscaler Performance
                    </h3>
                    <div className="space-y-2">
                      {stats.upscalerBreakdown.map((f) => (
                        <div
                          key={f.upscalerType}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-text/70 capitalize">
                            {f.upscalerType === "none"
                              ? "Native"
                              : f.upscalerType.toUpperCase()}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-text/80 font-medium tabular-nums">
                              {f.avgFps} FPS
                            </span>
                            <span className="text-text/40 text-xs">
                              ({f.count})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Row 4: Top Games */}
            {stats.topGames.length > 0 && (
              <div className="rounded-xl border border-border bg-text/[0.03] p-4">
                <h3 className="text-sm font-medium text-text/80 mb-3">
                  Top Games by Average FPS
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {stats.topGames.slice(0, 8).map((game, i) => (
                    <Link
                      key={game.gameId}
                      href={`/game/${game.gameId}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-text/5 border border-border hover:border-primary/30 transition-colors group"
                    >
                      <div
                        className="text-lg font-bold tabular-nums w-6"
                        style={{ color: deviceColor }}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {game.gameTitle}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-text/50">
                          <span className="text-green-400 font-medium">
                            {game.avgFps} FPS
                          </span>
                          <span>{game.benchmarkCount} runs</span>
                        </div>
                      </div>
                      <ArrowRightIcon className="h-3.5 w-3.5 text-text/20 group-hover:text-primary transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Empty state ──────────────────────────────────── */}
      {stats && !loading && !error && stats.totalBenchmarks === 0 && (
        <div className="max-w-7xl mx-auto px-4 md:px-[10svw]">
          <div className="text-center py-16 text-text/40">
            <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
            <p>No benchmark data yet for this device</p>
            <p className="text-sm mt-1">
              Data will appear as benchmarks are submitted
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-text/[0.03] min-w-[160px]">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs text-text/50">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify the page builds**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run build --no-lint 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/devices/[slug]/page.tsx app/devices/[slug]/device-detail-client.tsx
git commit -m "feat: redesign device detail page with fixes and improvements

- Fix upscalerBreakdown/fsrBreakdown property name mismatch
- Fix deviceTypeLabel map (handled → handheld)
- Fix device color to use per-device colorIndex instead of hardcoded 0
- Add image/icon hero section with device color accent
- Add error state with retry button
- Add generateStaticParams with ISR (1-hour revalidation)
- Enhanced SEO metadata with keywords, OG, Twitter cards
- Fix JSON-LD to use 'Handheld' label instead of raw enum value"
```

---

### Task 6: Per-Device OG Image & Remaining SEO

**Files:**
- Create: `app/devices/[slug]/opengraph-image.tsx`
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Create the per-device OG image generator**

Create `app/devices/[slug]/opengraph-image.tsx`:

```tsx
import { ImageResponse } from "next/og"
import { db } from "@/lib/db/index"
import { hardware, performanceEntries, gameVersions, games } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"

export const runtime = "edge"
export const alt = "Device benchmarks on DeckyVault"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [device] = await db
    .select({
      name: hardware.name,
      deviceType: hardware.deviceType,
    })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#100b14",
            color: "#ebe4f1",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700 }}>DeckyVault</div>
          <div style={{ fontSize: 20, color: "#6b5a7d", marginTop: 8 }}>
            Device Not Found
          </div>
        </div>
      ),
      { ...size }
    )
  }

  // Fetch basic stats
  const [stats] = await db
    .select({
      totalBenchmarks: sql<number>`count(*)::int`,
      avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
      gameCount: sql<number>`count(distinct ${gameVersions.gameId})::int`,
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .innerJoin(games, eq(gameVersions.gameId, games.id))
    .where(
      and(
        eq(performanceEntries.hardwareSlug, slug),
        eq(performanceEntries.isRemoved, false)
      )
    )

  const typeLabel = device.deviceType === "handheld" ? "Handheld" : "Console"
  const avgFpsStr = stats?.avgFps ? String(Math.round(Number(stats.avgFps))) : "—"

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          backgroundColor: "#100b14",
        }}
      >
        {/* Device Type Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              color: "#eb3779",
              backgroundColor: "#eb377920",
              border: "1px solid #eb377940",
            }}
          >
            {typeLabel}
          </div>
        </div>

        {/* Device Name */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#ebe4f1",
            lineHeight: 1.1,
            marginBottom: 24,
          }}
        >
          {device.name}
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: "flex",
            gap: 32,
            fontSize: 18,
            color: "#6b5a7d",
          }}
        >
          <div>
            <span style={{ color: "#ebe4f1", fontWeight: 600, fontSize: 24 }}>
              {stats?.totalBenchmarks ?? 0}
            </span>{" "}
            Benchmarks
          </div>
          <div>
            <span style={{ color: "#22c55e", fontWeight: 600, fontSize: 24 }}>
              {avgFpsStr}
            </span>{" "}
            Avg FPS
          </div>
          <div>
            <span style={{ color: "#ebe4f1", fontWeight: 600, fontSize: 24 }}>
              {stats?.gameCount ?? 0}
            </span>{" "}
            Games
          </div>
        </div>

        {/* Brand */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 80,
            fontSize: 16,
            color: "#4a3a5c",
            fontWeight: 500,
          }}
        >
          deckyvault.xyz
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 2: Update sitemap to exclude admin routes**

In `app/sitemap.ts`, there's currently nothing to exclude since admin pages don't exist yet, but we should ensure we don't add them. Since admin pages will set `robots: { index: false }`, Next.js won't include them. No code change needed here now — the admin layout will handle it.

However, verify the current sitemap doesn't list `/search` (which is noindexed). Check and fix if present.

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && grep -n "search" app/sitemap.ts`
Expected: Either no match or a line that should be removed.

If a `/search` entry exists with a sitemap listing, remove it since search is noindexed.

- [ ] **Step 3: Verify the OG image route compiles**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run build --no-lint 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/devices/[slug]/opengraph-image.tsx
# Only if sitemap.ts was changed:
git add app/sitemap.ts
git commit -m "feat: add per-device OG image generator for device detail pages

- Renders device name, type badge, and stats on branded dark background
- Uses Edge runtime for fast generation
- References OG image in device detail page metadata"
```
---

### Task 7: Admin Layout, Sidebar & Auth Guard

**Files:**
- Create: `app/(admin)/layout.tsx`
- Create: `app/(admin)/admin/page.tsx`
- Create: `components/admin/admin-sidebar.tsx`
- Modify: `components/navbar.tsx`
- Modify: `lib/routes.ts`

- [ ] **Step 1: Create the admin sidebar component**

Create `components/admin/admin-sidebar.tsx`:

```tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UsersIcon, CpuIcon, Gamepad2Icon } from "lucide-react"

const adminNavItems = [
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/hardware", label: "Hardware", icon: CpuIcon },
  { href: "/admin/games", label: "Games", icon: Gamepad2Icon },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav className="md:w-48 shrink-0">
      <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:border-r md:border-border">
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-lg md:rounded-none md:border-l-2 md:border-r-0 md:border-transparent ${
                isActive
                  ? "bg-primary/10 text-primary md:border-l-primary"
                  : "text-text/50 hover:text-text/70 hover:bg-text/5"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create the admin layout with server-side auth guard**

Create `app/(admin)/layout.tsx`:

```tsx
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: { template: "%s | Admin — DeckyVault", default: "Admin — DeckyVault" },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session || session.user.role !== "admin") {
    redirect("/")
  }

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* Header */}
      <div className="px-4 md:px-[10svw]">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">Admin</h1>
          <p className="text-sm text-text/60 mt-1">
            Manage users, hardware, and games
          </p>
        </div>
      </div>

      {/* Sidebar + Content */}
      <div className="px-4 md:px-[10svw]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6">
          <AdminSidebar />
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Create the admin redirect page**

Create `app/(admin)/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation"

export default function AdminPage() {
  redirect("/admin/users")
}
```

- [ ] **Step 4: Add admin link to navbar profile dropdown**

In `components/navbar.tsx`:

1. Add `ShieldIcon` to the lucide imports:
```tsx
import {
  Bookmark,
  CircleXIcon,
  Gamepad2Icon,
  LogOut,
  MenuIcon,
  ShieldIcon,
  User,
  XIcon,
} from "lucide-react"
```

2. In the **desktop profile dropdown** — right after the `{authRoutes.map(...)}` block and before the `<div className='my-1 border-t border-white/10' />` sign-out divider, add:
```tsx
{session.user.role === "admin" && (
  <>
    <div className="my-1 border-t border-white/10" />
    <Link
      href="/admin"
      onClick={() => setUserMenuOpen(false)}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
    >
      <ShieldIcon className="h-4 w-4" />
      Admin
    </Link>
  </>
)}
```

3. In the **mobile sidebar** — after `{authRoutes.map(...)}` in the mobile auth section, add:
```tsx
{session.user.role === "admin" && (
  <Link
    href="/admin"
    onClick={() => setMobileMenuOpen(false)}
    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
  >
    <ShieldIcon className="h-4 w-4" />
    Admin
  </Link>
)}
```

- [ ] **Step 5: Add admin routes to routes file**

In `lib/routes.ts`, append an `adminRoutes` export (not in the main `routes` nav — admin link only appears in the profile dropdown):

```ts
export const adminRoutes = [
  {
    title: "Users",
    href: "/admin/users",
    icon: "Users",
  },
  {
    title: "Hardware",
    href: "/admin/hardware",
    icon: "Cpu",
  },
  {
    title: "Games",
    href: "/admin/games",
    icon: "Gamepad2",
  },
]
```

- [ ] **Step 6: Build to verify**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run build --no-lint 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/(admin)/ components/admin/admin-sidebar.tsx components/navbar.tsx lib/routes.ts
git commit -m "feat: add admin layout with sidebar, auth guard, and navbar link

- Admin layout with server-side auth guard (redirects non-admins)
- Reusable sidebar component with active state detection
- Navbar profile dropdown shows admin link for admin users
- Admin routes are noindexed (robots: false)
- /admin redirects to /admin/users"
```

---

### Task 8: Admin Users Page

**Files:**
- Create: `app/(admin)/admin/users/page.tsx`
- Create: `app/(admin)/admin/users/users-client.tsx`

- [ ] **Step 1: Create the users server component**

Create `app/(admin)/admin/users/page.tsx`:

```tsx
import type { Metadata } from "next"
import { UsersClient } from "./users-client"

export const metadata: Metadata = {
  title: "Users",
}

export default function UsersPage() {
  return <UsersClient />
}
```

- [ ] **Step 2: Create the users client component**

Create `app/(admin)/admin/users/users-client.tsx` — a full user management table with search, role changing (user/contributor/admin), and ban/unban functionality using better-auth's admin plugin client methods (`authClient.admin.listUsers`, `authClient.admin.setRole`, `authClient.admin.banUser`/`unbanUser`). The component should:

- Fetch users on mount via `authClient.admin.listUsers({ query: { limit: 100 } })`
- Filter users client-side based on a search input
- Render a table with columns: User (avatar initial + name + email), Role (dropdown select), Status (active/banned dot), Actions (ban/unban button)
- Role dropdown uses `handleRoleChange` calling `authClient.admin.setRole({ userId, role })`
- Ban button calls `authClient.admin.banUser({ userId })` / `authClient.admin.unbanUser({ userId })`
- Style: rounded-xl border, table with text-sm, header row `bg-text/[0.03]`, status dots (green/red), role select with colored borders

Use the same Tailwind patterns as the rest of the app: `px-4 py-2.5`, `rounded-lg border border-border bg-text/5`, `text-text/50`, focus rings, etc.

- [ ] **Step 3: Commit**

```bash
git add app/(admin)/admin/users/
git commit -m "feat: add admin users management page

- User list with search by name/email
- Change role (user/contributor/admin) via dropdown
- Ban/unban users with status indicators
- Uses better-auth admin plugin client methods"
```

---

### Task 9: Admin Hardware Page

**Files:**
- Create: `app/(admin)/admin/hardware/page.tsx`
- Create: `app/(admin)/admin/hardware/hardware-client.tsx`

- [ ] **Step 1: Create the hardware server component**

Create `app/(admin)/admin/hardware/page.tsx`:

```tsx
import type { Metadata } from "next"
import { HardwareClient } from "./hardware-client"

export const metadata: Metadata = {
  title: "Hardware",
}

export default function HardwarePage() {
  return <HardwareClient />
}
```

- [ ] **Step 2: Create the hardware client component with CRUD**

Create `app/(admin)/admin/hardware/hardware-client.tsx` — a hardware management page with:

- **List**: Fetches from `/api/hardware/stats`, renders device cards (icon + name + slug + type badge + benchmark count) with edit/delete buttons
- **Add Device** button at top opens a modal form
- **Edit modal**: Pre-filled form for name, slug (readonly on edit), device type (select handheld/console), sort order, image URL
- **Delete**: Confirmation via `confirm()`, calls `DELETE /api/hardware/:slug`
- **Create**: Modal form, calls `POST /api/hardware` with body `{ slug, name, deviceType, image, sortOrder }`
- **Update**: Modal form, calls `PATCH /api/hardware/:slug` with body `{ name, deviceType, image, sortOrder }`
- Card grid uses same pattern as devices list page
- Modal styled: `fixed inset-0 z-50`, backdrop `bg-black/50`, form `bg-background border border-border rounded-xl p-6 max-w-md`

- [ ] **Step 3: Commit**

```bash
git add app/(admin)/admin/hardware/
git commit -m "feat: add admin hardware management page with CRUD

- Device list fetched from /api/hardware/stats
- Create/edit devices via modal form
- Delete with confirmation dialog
- Uses existing hardware CRUD API endpoints"
```

---

### Task 10: Admin Games Page

**Files:**
- Create: `app/(admin)/admin/games/page.tsx`
- Create: `app/(admin)/admin/games/games-client.tsx`

- [ ] **Step 1: Create the games server component**

Create `app/(admin)/admin/games/page.tsx`:

```tsx
import type { Metadata } from "next"
import { GamesClient } from "./games-client"

export const metadata: Metadata = {
  title: "Games",
}

export default function GamesPage() {
  return <GamesClient />
}
```

- [ ] **Step 2: Create the games client component**

Create `app/(admin)/admin/games/games-client.tsx` — a games management page with:

- **List**: Fetches from `/api/games?limit=50` (existing CRUD endpoint with search support), renders a table
- **Search**: Debounced input, passes `?search=query` to the API
- **Table columns**: Cover image (small thumbnail via `next/image`), Title, Developer, Source (Steam/manual badge), Sync Status (badge), Actions
- **Actions**: "View" link to `/game/:id` (external-link icon), "Delete" button (admin only, calls `DELETE /api/games/:gameId`)
- **Pagination**: "Load more" button or offset-based pagination controls (`?offset=N&limit=50`)
- Style: same table pattern as users page

- [ ] **Step 3: Commit**

```bash
git add app/(admin)/admin/games/
git commit -m "feat: add admin games management page

- Game list with search and pagination
- Source and sync status badges
- View on site link and delete action
- Uses existing games CRUD API"
```

---

### Task 11: Sitemap Update & Final SEO

**Files:**
- Modify: `app/sitemap.ts`

- [ ] **Step 1: Remove /search from sitemap since it's noindexed**

In `app/sitemap.ts`, find and remove any entry for `/search` (it's noindexed in its layout metadata, so including it in the sitemap is contradictory).

- [ ] **Step 2: Commit**

```bash
git add app/sitemap.ts
git commit -m "fix: remove noindexed /search page from sitemap"
```

---

### Task 12: Build, Lint & Cleanup

**Files:** All modified/created files

- [ ] **Step 1: Run full build**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run build 2>&1`
Expected: Build succeeds with zero errors.

- [ ] **Step 2: Fix any build errors**

If the build fails, read the error messages, fix them, and re-run.

- [ ] **Step 3: Run linter**

Run: `cd /Users/adrianbonpin/Documents/Code/personal/deckyvault && bun run lint 2>&1`
Expected: No errors.

- [ ] **Step 4: Fix any lint warnings**

If lint issues exist, fix them and re-run.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: fix build errors and lint warnings from devices/admin implementation"
```

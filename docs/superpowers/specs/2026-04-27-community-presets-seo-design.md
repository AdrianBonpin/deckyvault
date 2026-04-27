# Community Presets UX + SEO Overhaul Design Spec

## Overview

Two major improvements to DeckyVault:
1. **Community Presets UX Overhaul** — View settings, delete/report, horizontal layout, reorder above graphs
2. **SEO Robustness** — Dynamic metadata, sitemap expansion, JSON-LD, dynamic OG images for game pages

---

## Area 1: Community Presets UX Overhaul

### 1.1 Layout Change — Horizontal Scroll Row

**Current:** 3-column vertical grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)

**Proposed:** Single horizontal scroll row (`flex overflow-x-auto`) with cards ordered newest-first (left-to-right). Cards are date-sorted by `createdAt` descending, so the newest preset appears leftmost.

Implementation:
- Use `flex overflow-x-auto gap-4 pb-4` on the container
- Each card is a `flex-shrink-0 w-72` (or similar fixed width)
- Hide scrollbar via CSS (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`)
- Add left/right scroll buttons (chevrons) overlaid at the edges for discoverability

### 1.2 Section Reorder — Presets Above Statistics

**Current:** Section order in `game-page-client.tsx`:
1. Hero Header
2. About + Details
3. Device Selector + Filters
4. Statistics Dashboard (charts)
5. Community Presets

**Proposed:**
1. Hero Header
2. About + Details
3. Device Selector + Filters
4. **Community Presets** ← moved up
5. Statistics Dashboard ← moved down

Simply reorder the two `<motion.div>` sections in the JSX.

### 1.3 View Settings — AnimatePresence Modal

**Current:** Preset cards show summary info (FPS, upvotes, tech tags, settings count) but the actual `settingsJson` content is not displayed anywhere.

**Proposed:** Clicking a preset card opens a modal using `AnimatePresence` + `layoutId` for a smooth animated transition from the card to the expanded modal. The modal shows:

- **Settings Table**: Each `GameSettingCategory` rendered as a collapsible section with category name as header, and settings as a two-column table (setting name → value)
- **Full Metadata**: Device name, Proton version, SteamOS version, FPS (avg/min/max), Upscaler, Frame Gen, Launch Options, User Notes
- **Community info**: Submitter (if we include userId in the preset data), upvotes/downvotes, verified badge, creation date
- **Actions**: Upvote/downvote buttons, Report button, Delete button (owner/admin only)

Animation detail:
- Each card has a `layoutId={preset.id}` on the card container
- The modal wrapper uses the same `layoutId` when replacing the card
- `AnimatePresence mode="wait"` wraps the transition
- The card's click handler sets `selectedPresetId` state
- When `selectedPresetId` is set, render the modal overlay with `motion.div layoutId={selectedPresetId}`

### 1.4 Delete — Soft Delete for Owners + Admins

**Current API state:**
- Admin soft-delete via `DELETE /api/performance/:id` (sets `isRemoved: true`)
- Owner hard-delete via `DELETE /api/performance/:id/user-delete` (permanently removes row)

**Proposed changes:**

#### 1.4.1 Change user-delete to soft delete

Modify the `/api/performance/:id/user-delete` endpoint to set `isRemoved: true` instead of hard-deleting. This aligns owner deletes with admin deletes. Add an optional `reason` body parameter that sets `removedReason`.

#### 1.4.2 Delete UI in preset modal

In the preset detail modal:
- **Owner sees**: A "Delete" button (red, secondary style). Clicking it shows a confirmation dialog: "Are you sure you want to remove this preset? This can be undone by an admin." On confirm, calls `DELETE /api/performance/:id/user-delete`.
- **Admin sees**: Same "Delete" button on any preset (not just their own).
- **Other users**: No delete button.

### 1.5 Report Flow

**New database table: `reports`**

| Column | Type | Notes |
|---|---|---|
| id | text PK | UUID auto-generated |
| entryId | text FK → performance_entries.id | onDelete: cascade |
| reporterId | text FK → user.id | onDelete: cascade |
| reason | enum(inaccurate, spam, inappropriate, other) | Required |
| details | text | Optional free-text |
| status | enum(open, reviewed, dismissed) | Default: open |
| createdAt | timestamp | Default: now() |

**New API route: `POST /api/performance/:id/report`**

- Auth required (any user role)
- Body: `{ reason: "inaccurate" | "spam" | "inappropriate" | "other", details?: string }`
- Prevents duplicate reports (one report per user per entry)
- Returns the created report

**Report UI in preset modal:**
- Every preset card/modal shows a "Report" icon button (flag icon)
- Clicking it opens a small popover/dropdown with reason selection
- On submit, calls the API and shows a toast "Report submitted. Thank you."
- If user already reported this entry, show "Already reported" instead

### 1.6 Preset Data Enrichment

The server component currently does not pass `userId`, `settingsJson` (full content), or `userNotes` to the client. To support the modal view:

**Changes to `app/game/[id]/page.tsx` serialized presets:**

Add these fields to the `serializedPresets` mapping:
- `settingsJson` — the full `GameSettingCategory[]` array
- `userNotes` — string | null
- `userId` — the owner's user ID (needed for delete permission check)
- `userName` — the owner's display name
- `userImage` — the owner's avatar URL
- `launchOptions` — string | null
- `downvotes` — number
- `verifiedAt` — string | null

The SQL query in `page.tsx` needs to join on `user` table to get `userName` and `userImage`.

### 1.7 Client-Side Preset Type Update

Update the `Preset` interface in `game-page-client.tsx` to include the new fields:
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

---

## Area 2: SEO Overhaul

### 2.1 Game Details Page — Dynamic Metadata

**Current:** `export const metadata = { title: "Game" }` — no game-specific data in metadata.

**Proposed:** Replace with `generateMetadata` function:

```typescript
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params
    // ... resolve game (reuse existing logic)
    return {
        title: `${game.title} - Benchmarks & Settings`,
        description: game.description
            ? `${game.description.slice(0, 160)}`
            : `Find benchmarks, community presets, and performance settings for ${game.title} on Steam Deck.`,
        openGraph: {
            title: `${game.title} - Benchmarks & Settings | DeckyVault`,
            description: game.description?.slice(0, 200) ?? `Benchmarks and settings for ${game.title}`,
            url: `https://deckyvault.xyz/game/${game.id}`,
            images: [{ url: `/game/${game.id}/opengraph-image`, width: 1200, height: 630 }],
            type: "website",
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

### 2.2 Game Details Page — JSON-LD Structured Data

Add a `<script type="application/ld+json">` in the game page with `VideoGame` schema:

```json
{
  "@context": "https://schema.org",
  "@type": "VideoGame",
  "name": "{game.title}",
  "developer": { "@type": "Organization", "name": "{game.developer}" },
  "genre": "{game.genres}",
  "image": "{game.headerImage}",
  "url": "https://deckyvault.xyz/game/{game.id}",
  "applicationCategory": "Game",
  "operatingSystem": "SteamOS",
  "offers": game.storeUrl ? { "@type": "Offer", "url": game.storeUrl } : undefined
}
```

### 2.3 Game Details Page — Dynamic OG Image

Create `app/game/[id]/opengraph-image.tsx`:

- Uses `ImageResponse` from `next/og`
- Renders: game title, key FPS stat, "DeckyVault" branding on branded background
- Falls back to the generic OG image if the game has no header image
- Exports `alt`, `size`, `contentType` as required by Next.js convention
- Uses `generateStaticParams` for known games, falls back to dynamic generation
- Actually, since game IDs are dynamic, we use the default dynamic approach (no `generateStaticParams`)

### 2.4 Search Page Metadata

**Current:** No metadata export at all.

**Proposed:**
```typescript
export const metadata = {
    title: "Search Games",
    description: "Search for games and find benchmarks, settings, and performance data on DeckyVault.",
    robots: { index: false }, // Search results pages shouldn't be indexed
}
```

Also wrap search in a client component that uses `next/navigation` `useSearchParams` with Suspense boundary (already done).

### 2.5 Landing Page — JSON-LD

Add `WebSite` schema to the landing page:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "DeckyVault",
  "url": "https://deckyvault.xyz",
  "description": "Steam Deck benchmarks, settings, and performance guides",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://deckyvault.xyz/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

### 2.6 Devices Page — JSON-LD + Metadata

**Current metadata:** `title: "Devices — DeckyVault"` and `description: "Browse handheld and console devices..."`

**Proposed additions:**
- Add `ItemList` JSON-LD schema listing all devices
- Ensure OpenGraph metadata is present

### 2.7 Device Detail Page — JSON-LD

Add `Product` schema to device detail pages:

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{device.name}",
  "category": "{device.deviceType}",
  "brand": { "@type": "Brand", "name": device.manufacturer },
  "url": "https://deckyvault.xyz/devices/{device.slug}"
}
```

### 2.8 Sitemap Expansion

**Current:** Only homepage.

**Proposed:** Add all game pages, device pages, and static pages:

```typescript
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const games = await db.select({ id: games.id, updatedAt: games.updatedAt }).from(games)
    const devices = await db.select({ slug: hardware.slug, updatedAt: hardware.updatedAt }).from(hardware)

    const gameEntries = games.map(game => ({
        url: `https://deckyvault.xyz/game/${game.id}`,
        lastModified: game.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
    }))

    const deviceEntries = devices.map(device => ({
        url: `https://deckyvault.xyz/devices/${device.slug}`,
        lastModified: device.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.6,
    }))

    return [
        { url: "https://deckyvault.xyz", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
        { url: "https://deckyvault.xyz/search", lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
        { url: "https://deckyvault.xyz/devices", lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
        ...gameEntries,
        ...deviceEntries,
    ]
}
```

### 2.9 robots.ts Review

Current `robots.ts` is fine — allows all crawling and references the sitemap. No changes needed.

### 2.10 Canonical URLs

Add `alternates.canonical` to all page metadata to prevent duplicate content issues:

- Landing: `canonical: "https://deckyvault.xyz"`
- Game detail: `canonical: "https://deckyvault.xyz/game/{id}"`
- Device detail: `canonical: "https://deckyvault.xyz/devices/{slug}"`
- Search: `canonical: "https://deckyvault.xyz/search"`
- Devices: `canonical: "https://deckyvault.xyz/devices"`

---

## File Impact Summary

### Files to Modify:
1. `lib/db/schema/reports.ts` — **New** (reports table)
2. `lib/db/schema/index.ts` — **Modify** (add reports export)
3. `drizzle.config.ts` — may need migration
4. `lib/api/reports.ts` — **New** (report API routes)
5. `lib/api/index.ts` — **Modify** (add reports routes)
6. `lib/api/performance.ts` — **Modify** (change user-delete to soft delete)
7. `app/api/[[...slugs]]/route.ts` — **Modify** (mount new routes)
8. `app/game/[id]/page.tsx` — **Modify** (add generateMetadata, enrich preset data, add JSON-LD)
9. `app/game/[id]/game-page-client.tsx` — **Modify** (horizontal layout, modal, delete/report UI, reorder sections)
10. `app/game/[id]/opengraph-image.tsx` — **New** (dynamic OG image)
11. `app/sitemap.ts` — **Modify** (add games, devices, static pages)
12. `app/search/page.tsx` — **Modify** (add metadata export)
13. `app/page.tsx` — **Modify** (add JSON-LD)
14. `app/devices/page.tsx` — **Modify** (add JSON-LD)
15. `app/devices/[slug]/page.tsx` — **Modify** (add JSON-LD, canonical URL)

### Files to Create:
1. `lib/db/schema/reports.ts`
2. `lib/api/reports.ts`
3. `app/game/[id]/opengraph-image.tsx`

---

## Edge Cases & Considerations

1. **Pagination of presets**: If a game has 50+ presets, the horizontal scroll could get long. Consider adding a "Show all" toggle or lazy loading. For now, we'll keep it simple — just horizontal scroll with no pagination limit, as most games will have < 20 presets.

2. **Report duplicate prevention**: The API should prevent a user from reporting the same entry twice. A unique constraint on `(entryId, reporterId)` handles this.

3. **Soft delete visibility**: Once soft-deleted, a preset must disappear from the game page (already handled by `isRemoved: false` filter). Admin UI (future) should see deleted entries.

4. **OG image generation performance**: Dynamic OG image generation hits the DB on every request. Next.js caches these, but we should add appropriate `revalidate` headers.

5. **Sitemap scalability**: For large game databases, the sitemap could get huge. Consider splitting into multiple sitemaps (games sitemap, devices sitemap) with a sitemap index. For now, a single sitemap is fine since the game count will be manageable.

6. **Horizontal scroll on mobile**: Touch scrolling works naturally. The chevron buttons should be hidden on mobile (only visible on desktop hover).
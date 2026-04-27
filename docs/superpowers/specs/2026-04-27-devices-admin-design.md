# Devices Page Redesign & Admin Panel — Design Spec

**Date:** 2026-04-27
**Scope:** Fix devices page bugs, redesign devices list/detail pages, add admin management panel, remove broken Community Trust graph

---

## 1. Bug Fixes

### 1.1 `"handled"` → `"handheld"` Enum Typo

The `device_type` PostgreSQL enum has `"handled"` instead of `"handheld"`. This propagates to every layer:

- **DB:** `pgEnum("device_type", ["handled", "console"])` in `lib/db/schema/hardware.ts`
- **Seed:** `"handled" as const` in `lib/db/seed.ts`
- **API responses:** `deviceType: "handled"` returned from `/api/hardware/stats` and `/api/hardware/:slug/stats`
- **Client maps:** List page uses `{ handheld: "Handheld" }` (never matches), detail page uses `{ handled: "Handheld" }` (matches the typo)
- **JSON-LD:** Outputs `"handled"` as the `category` field on device detail pages

**Fix:** Create a Drizzle migration that:
1. Renames the enum value from `"handled"` to `"handheld"` using `ALTER TYPE device_type RENAME VALUE 'handled' TO 'handheld'`
2. Updates any existing rows that reference the old value (though enum values are stored by reference, not value, so the ALTER TYPE handles this)

Then update all code references:
- `lib/db/schema/hardware.ts`: `pgEnum("device_type", ["handheld", "console"])`
- `lib/db/seed.ts`: `"handheld" as const`
- `app/devices/page-client.tsx`: `deviceTypeLabel` map (already correct with `"handheld"` key)
- `app/devices/[slug]/device-detail-client.tsx`: `deviceTypeLabel` map (change `"handled"` → `"handheld"`)

### 1.2 `upscalerBreakdown` vs `fsrBreakdown` Property Mismatch

The API (`hardware-stats.ts`) returns `upscalerBreakdown` on the detail stats, but the client (`device-detail-client.tsx`) TypeScript interface and render code uses `fsrBreakdown`. At runtime, `stats.fsrBreakdown` is `undefined`, silently breaking the upscaler section.

**Fix:** Rename the client interface and rendering code to use `upscalerBreakdown` to match the API. Update the TypeScript interface and all references in `device-detail-client.tsx`.

### 1.3 `avgFps` Includes Nulls as Zero

In `lib/api/hardware-stats.ts`, the `/:slug/stats` endpoint computes:
```ts
const avgFps = Math.round((entries.reduce((s, e) => s + (e.fpsAvg ?? 0), 0) / totalBenchmarks) * 10) / 10
```

This treats null FPS entries as 0, reducing the true average. The `/stats` list endpoint already handles this correctly using SQL `avg()` which ignores nulls.

**Fix:** Filter out null FPS entries before computing the average:
```ts
const fpsEntries = entries.filter(e => e.fpsAvg !== null)
const avgFps = fpsEntries.length > 0
  ? Math.round((fpsEntries.reduce((s, e) => s + e.fpsAvg!, 0) / fpsEntries.length) * 10) / 10
  : null
```

---

## 2. Devices Page Redesign

### 2.1 List Page (`/devices`)

**Architecture:** Server component fetches devices with aggregated stats from DB, passes serialized data as props to client component. Eliminates the redundant client-side fetch to `/api/hardware/stats`.

**Layout:**
- Hero header with title "Devices" and description "Browse benchmarks for handheld and console devices"
- Pill-based device type filter tabs: All / Handheld / Console (matches game-page filter pattern)
- Responsive card grid (1-col mobile, 2-col tablet, 3-col desktop)
- Stagger animation capped at `min(i * 0.05, 0.5)` seconds max delay

**Card design:**
- Device image (or icon fallback with colored background) — top/leading section
- Device name (bold, hover → primary color)
- Device type badge (colored pill: Handheld = pink, Console = purple)
- 4-column stat row: Benchmarks / Avg FPS / Games / Verified
- Top game preview (title + FPS)
- Arrow icon on hover

**SEO:**
- Static metadata with `title`, `description`, `keywords`, `openGraph`, `alternates`
- JSON-LD `ItemList` with correct device type labels ("Handheld" not "handled")

### 2.2 Detail Page (`/devices/[slug]`)

**Architecture:** Server component fetches device info + stats from the API endpoint (server-side), passes serialized data as props. Eliminates client-side fetch. Falls back to `notFound()` for invalid slugs.

**Hero section:**
- Device image (or large styled Gamepad2Icon in colored container as fallback)
- Device name (large, bold)
- Device type badge
- Verified count badge

**Stats row:** 4 stat cards — Total Benchmarks / Average FPS / Games Tested / Verified (same `StatCard` component pattern as game page)

**Charts section:**
- Historical FPS line chart (same as current)
- FPS Boxplot per game (same as current)
- Genre Breakdown donut (same as current)
- Proton Version Distribution bar (same as current)
- Upscaler Version Performance list (renamed from FSR, same data)
- Top Games grid (same as current, but fixed device color per device)

**Removed:** Community Trust bar chart (TrustBar). No replacement — the section is simply removed from both the game detail page and the device detail page.

**Error handling:** Error state with retry button when fetch fails.

**`generateStaticParams`:** Added with `revalidate = 3600` (ISR, 1-hour cache).

**Per-device OG image:** `app/devices/[slug]/opengraph-image.tsx` renders device name + type + stats on branded dark background.

**SEO:** Dynamic `generateMetadata` with title, description, keywords, openGraph, alternates, robots.

### 2.3 Hardware Schema — Image Column

Add nullable `image` column to `hardware` table:
```ts
image: text("image"), // nullable — URL to device image
```

Migration adds the column as optional. Seed updated to include image URLs where available. Where `image` is null, UI shows a styled icon fallback.

### 2.4 Device-specific Colors

Currently `getDeviceColor(0)` hardcodes pink for all devices. Fix to use device slug as index:
```ts
const colorIndex = CHART_THEME.deviceColors.length > 0
  ? devices.findIndex(d => d.slug === device.slug) % CHART_THEME.deviceColors.length
  : 0
```

Or simpler: pass device list index from server.

---

## 3. Community Trust Removal

Remove the TrustBar chart from both pages where it appears:

- **`app/game/[id]/game-page-client.tsx`:** Remove `TrustBar` import, remove `trust` from the stats interface, remove the "Community Trust" section from the render
- **`components/charts/TrustBar.tsx`:** Delete the file
- **`lib/api/game-stats.ts`:** Remove section 9 (trust data) from the response — stop shipping `trust` array
- **`lib/api/hardware-stats.ts`:** No trust data in this endpoint (already doesn't have it)

The trust/upvote/downvote columns remain in the database — they're not removed. The vote API endpoints (`/:id/upvote`, `/:id/downvote`) also remain. This is purely a UI removal of a chart that displays meaningless data. A proper voting system can be built in the future and the chart re-added at that time.

---

## 4. Admin Panel

### 4.1 Route Structure

```
app/(admin)/
  layout.tsx              — shared layout: sidebar + auth guard
  admin/
    page.tsx              — redirect to /admin/users
    users/
      page.tsx            — server: fetch users, pass to client
      users-client.tsx    — client: user management UI
    hardware/
      page.tsx            — server: fetch hardware, pass to client
      hardware-client.tsx — client: hardware CRUD UI
    games/
      page.tsx            — server: fetch games, pass to client
      games-client.tsx    — client: game management UI
```

The `(admin)` route group uses parentheses to avoid nesting in URLs. The layout at `app/(admin)/layout.tsx` wraps all admin pages with the sidebar and auth guard.

**URL structure:**
- `/admin` → redirects to `/admin/users`
- `/admin/users` → user management
- `/admin/hardware` → hardware management
- `/admin/games` → game management

### 4.2 Auth Guard

**Server-side:** The admin layout component checks `auth.api.getSession()` from headers. If no session or `user.role !== "admin"`, call `redirect("/")` from `next/navigation`.

**Client-side:** As a fallback, the client components check `useSession()` and redirect non-admins.

**Metadata:** All admin pages set `robots: { index: false }` to prevent search engine indexing.

### 4.3 Sidebar Component

`components/admin/admin-sidebar.tsx` — reusable sidebar nav component.

**Pattern:** Matches the existing `settings-container.tsx` sidebar pattern (vertical on desktop, horizontal scroll on mobile).

- **Desktop:** `md:w-48 shrink-0` sidebar with border-right, active item gets `bg-primary/10 text-primary border-l-primary border-l-2`
- **Mobile:** Horizontal scrollable tabs with `overflow-x-auto`
- **Active detection:** Uses `usePathname()` to highlight current section
- **Items:**
  - Users (icon: `UsersIcon`)
  - Hardware (icon: `CpuIcon`)
  - Games (icon: `Gamepad2Icon`)

### 4.4 Admin — Users Page

**Data:** Uses `authClient.admin.listUsers()` with pagination. Falls back to a custom API endpoint if better-auth's listUsers doesn't provide enough data.

**UI:**
- Search input (filters by name/email)
- Table: Avatar (or initials) | Name | Email | Role (badge) | Status (active/banned) | Joined | Actions
- Actions dropdown: Change Role (user/contributor/admin), Ban/Unban
- Role badges: `admin` in red, `contributor` in yellow, `user` in gray
- Status: active (green dot) / banned (red dot)

**API:** Uses better-auth admin plugin client methods:
- `authClient.admin.listUsers()` for listing
- `authClient.admin.banUser({ userId })` / `authClient.admin.unbanUser({ userId })` for banning
- `authClient.admin.setRole({ userId, role })` for role changes

### 4.5 Admin — Hardware Page

**Data:** Fetches from `/api/hardware/stats` (existing endpoint) for the list with aggregated stats. For create/edit, uses `/api/hardware` CRUD endpoints.

**UI:**
- "Add Device" button at top
- Card list (not table — matches the public devices page pattern)
- Each card: device image (or icon) | name | slug | type badge | stats row (benchmarks / FPS / games) | Edit / Delete buttons
- Edit modal: inline form for name, slug, device type, sort order, image URL
- Delete: confirmation dialog, calls `DELETE /api/hardware/:slug`
- Create: modal form, calls `POST /api/hardware`

### 4.6 Admin — Games Page

**Data:** Fetches from `/api/games` with pagination and search support (existing CRUD endpoint).

**UI:**
- Search input with debounce
- Table: Cover image | Title | Developer | Source (steam/manual) | Sync status | Benchmarks count | Actions
- Actions: View on site (link to `/game/:id`), Sync now (triggers re-sync from Steam), Delete
- Pagination controls at bottom

### 4.7 Navbar Update

Add admin link to the profile dropdown in `components/navbar.tsx`:
```tsx
{session?.user?.role === "admin" && (
  <Link href="/admin" className="flex items-center gap-2 ...">
    <ShieldIcon className="h-4 w-4" />
    Admin
  </Link>
)}
```

Conditionally rendered based on `session.user.role === "admin"`.

### 4.8 Routes Update

Add admin route to `lib/routes.ts` — but only for reference, not in the main nav. Admin link goes in the profile dropdown only.

### 4.9 Sitemap Update

Exclude `/admin` and its subpages from `app/sitemap.ts`. Admin pages should not appear in the sitemap.

---

## 5. SEO Improvements Summary

| Page | Current | Improved |
|------|---------|----------|
| `/devices` | Basic title/description | Full OG, keywords, correct JSON-LD |
| `/devices/[slug]` | Basic metadata | `generateMetadata` with full OG, keywords, per-device OG image |
| `/admin/*` | N/A | `robots: { index: false }`, `noIndex: true` |
| All device pages | `"handled"` in JSON-LD | `"Handheld"` corrected label |
| Device detail | No `generateStaticParams` | ISR with 1-hour revalidation |

---

## 6. Files to Create

| File | Purpose |
|------|---------|
| `drizzle/0011_rename-handled-to-handheld-add-image.sql` | DB migration |
| `app/devices/opengraph-image.tsx` | Per-device OG image |
| `app/(admin)/layout.tsx` | Admin layout with sidebar + auth guard |
| `app/(admin)/admin/page.tsx` | Redirect to /admin/users |
| `app/(admin)/admin/users/page.tsx` | Users server component |
| `app/(admin)/admin/users/users-client.tsx` | Users management UI |
| `app/(admin)/admin/hardware/page.tsx` | Hardware server component |
| `app/(admin)/admin/hardware/hardware-client.tsx` | Hardware CRUD UI |
| `app/(admin)/admin/games/page.tsx` | Games server component |
| `app/(admin)/admin/games/games-client.tsx` | Games management UI |
| `components/admin/admin-sidebar.tsx` | Reusable admin sidebar nav |

## 7. Files to Modify

| File | Changes |
|------|---------|
| `lib/db/schema/hardware.ts` | Fix enum to `"handheld"`, add `image` column |
| `lib/db/seed.ts` | Fix `"handled"` → `"handheld"` |
| `lib/api/hardware-stats.ts` | Fix avgFps nulls, rename `fsrBreakdown` → `upscalerBreakdown` (already named that) |
| `app/devices/page.tsx` | RSC data fetching, enhanced metadata |
| `app/devices/page-client.tsx` | Full redesign with filter tabs, cards, fix deviceTypeLabel |
| `app/devices/[slug]/page.tsx` | Enhanced metadata, generateStaticParams, RSC data passing |
| `app/devices/[slug]/device-detail-client.tsx` | Fix bugs, remove TrustBar, image/icon hero, error state |
| `app/game/[id]/game-page-client.tsx` | Remove TrustBar import and section |
| `lib/api/game-stats.ts` | Remove `trust` from response |
| `components/charts/TrustBar.tsx` | Delete |
| `lib/routes.ts` | Add admin route reference |
| `components/navbar.tsx` | Add conditional admin link |
| `app/sitemap.ts` | Exclude admin routes |

---

## 8. Out of Scope

- **Reports management page** — deferred to future iteration
- **Admin dashboard/overview** — deferred to future iteration
- **Performance entry verification UI in admin** — deferred, can be added to a future admin/performance page
- **Voting system redesign** — removing TrustBar is in scope, but building a proper vote deduplication system is out of scope
- **Device image uploads** — image column accepts URLs; upload flow is out of scope
- **SQL aggregation optimization** for device stats endpoint — beneficial but out of scope for this iteration
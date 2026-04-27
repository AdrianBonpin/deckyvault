# Consolidate Community Presets into Performance Entries

## Problem

The `community_presets` table is a separate entity that duplicates much of `performance_entries` (settingsJson, hardwareSlug, upvotes, timestamps) while requiring complex JOINs on the game page. There is no UI to create presets — the wizard only creates performance entries. Meanwhile, users cannot delete their own submissions.

## Design

### 1. Eliminate communityPresets — settingsJson ≠ null IS the preset

Any `performanceEntry` where `settingsJson IS NOT NULL` automatically appears as a "Community Preset" on the game page. No new column needed. The `settingsJson` column already exists on `performanceEntries` with the exact same type as `communityPresets.settingsJson`.

**Display logic**: Preset display names are auto-generated from entry data: `"{hardwareName} · {fpsAvg}fps"` with upscaler/frame-gen badges if present. No `name` or `description` columns added.

**Migration**: Drop `communityPresets` table entirely (no production data to preserve). No data migration needed.

### 2. User-owned hard delete

Users can permanently delete their own performance entries via `DELETE /api/performance/:id`. Authorization: `userId === session.user.id || role === "admin"`. This is a hard `DELETE FROM` — not a soft delete.

### 3. Unified voting

The existing `upvotes`/`downvotes` columns on `performanceEntries` replace the single `upvotes` column on `communityPresets`. Entries with settingsJson (presets) use the same upvote/downvote endpoints that already exist on the performance API.

## Affected Files

### Schema
- `lib/db/schema/communityPresets.ts` — DELETE entire file
- `lib/db/schema/index.ts` — Remove communityPresets re-export
- `lib/db/schema/performanceEntries.ts` — No changes (already has settingsJson, upvotes, downvotes)

### API Routes
- `lib/api/presets.ts` — DELETE entire file (CRUD, upvote, settings routes all removed)
- `lib/api/index.ts` — Remove preset route re-exports
- `lib/api/performance.ts` — Add user-scoped hard delete endpoint
- `lib/api/search-unified.ts` — Replace communityPresets count with filtered performanceEntries count

### Pages / UI
- `app/game/[id]/page.tsx` — Rewrite preset query: SELECT from performanceEntries WHERE settingsJson IS NOT NULL, JOIN gameVersions+hardware. Remove communityPresets imports/queries.
- `app/game/[id]/game-page-client.tsx` — Update Preset interface to match new data shape. Remove `name`/`description` fields. Auto-generate display names.

### Migration
- New Drizzle migration: DROP TABLE community_presets

## Query Changes

### Before (game page presets)
```sql
SELECT cp.*, pe.fps_avg, pe.fps_low, ...
FROM community_presets cp
  LEFT JOIN performance_entries pe ON cp.performance_entry_id = pe.id
  INNER JOIN hardware h ON cp.hardware_slug = h.slug
WHERE cp.game_id = $1
ORDER BY cp.upvotes DESC
```

### After (game page presets)
```sql
SELECT pe.id, pe.hardware_slug, h.name as hardware_name,
       pe.fps_avg, pe.fps_low, pe.fps_high,
       pe.upscaler_type, pe.upscaler_version, pe.frame_gen_method,
       pe.proton_version, pe.os_version,
       pe.settings_json, pe.upvotes, pe.created_at
FROM performance_entries pe
  INNER JOIN game_versions gv ON pe.version_id = gv.id
  INNER JOIN hardware h ON pe.hardware_slug = h.slug
WHERE gv.game_id = $1
  AND pe.settings_json IS NOT NULL
  AND pe.is_removed = false
ORDER BY pe.upvotes DESC
```

## Preset Display Name Generation

```typescript
function generatePresetName(preset: Preset): string {
  const parts = [preset.hardwareName]
  if (preset.fpsAvg !== null) parts.push(`${preset.fpsAvg}fps`)
  return parts.join(' · ')
}
```

Upscaler and frame-gen are shown as badges next to the name, not in the name itself — matching the current game-page-client.tsx rendering.

## Edge Cases

- **Empty settingsJson array `[]`**: The wizard sends `settingsJson: settingsJson.length > 0 ? settingsJson : null`, so empty arrays are never stored. The query uses `IS NOT NULL` which is sufficient.
- **User tries to delete another user's entry**: 403 Forbidden unless admin.
- **Game page with no entries having settingsJson**: The presets section shows "No presets yet" — same as current empty state.
- **Upvoting presets**: Use the existing `POST /api/performance/:id/upvote` endpoint — works for all entries including presets.

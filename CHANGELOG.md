# Changelog

All notable changes to DeckyVault will be documented in this file.

## [2026.2.0] - 2026-05-20

### Added
- **ProtonDB URL compatibility:** `/app/[steamid]` permanently redirects to `/game/[steamid]` — replace `protondb.com` with `deckyvault.xyz` in any ProtonDB URL to land on the matching DeckyVault game page
- **Human-readable share URLs:** share button now copies clean URLs with numeric Steam App IDs for Steam games and title-based slugs for non-Steam games, instead of opaque UUIDs
- **Auto-generated slugs for non-Steam games:** new `slug` column on `games` table, populated on creation from the game title with automatic deduplication

### Changed
- Share URLs now use `steamAppId` (Steam) or `slug` (non-Steam) instead of the internal UUID

### Technical
- Added `slug` column to `games` table with partial unique index
- Extended `resolveGame()` to support slug-based lookups as a fallback resolution path
- Added `lib/utils/slug.ts` for slug generation utility
- Backfilled slugs for all existing non-Steam games

## [2026.1.0] - 2026-05-16

### Added
- **Moderator role** with content moderation permissions (verify entries, handle reports, review suggestions, manage comments) — sits between contributor and admin
- **Moderation analytics tab** with ECharts time-series: benchmark submissions, user registrations, device distribution, and genre popularity over 90 days
- **Ban reason and expiry UI** in user management — modal with optional reason and duration, plus active/banned filter tabs
- **Steam Sale section** on landing page showing discounted games with ≥3 benchmarks, sorted by performance — includes discount badges, pricing, and review scores
- Database performance indexes: `perf_removed_created_idx`, `perf_upvotes_idx`, `reports_status_idx`, `suggestions_status_idx`, `games_sync_status_idx`, `perf_game_lookup_idx`
- In-memory 5-minute cache for manage dashboard stats endpoint
- Auto-pin unit tests covering threshold edge cases

### Changed
- **Performance tags (Raw Performer/Poor Performance/best FPS) now scoped to handheld devices** (Steam Deck OLED/LCD) by default — console (Steam Machine) data no longer influences the badges shown on game cards, listings, and search results
- **Public dashboard** now uses full-width layout matching game details page styling (no `max-w` constraint)
- Moderator role added between contributor and admin; manage sidebar adapts to show role-appropriate navigation (hides Users, Storage for moderators)
- Manage panel now requires moderator or admin role for access (previously contributor+)
- Content moderation endpoints (reports, suggestions, comments, benchmark removal) gated to moderator+

### Fixed
- **Submit wizard drag-and-drop** no longer triggers text selection or touch-scroll interference on settings and screenshot reorder handles
- **Editing entries with screenshots** now shows existing screenshots in the Review step with remove capability; supports hybrid existing + new screenshot management

### Security
- Manage panel access restricted to moderator+ (up from contributor+)
- Destructive benchmark operations (remove, hard-delete, restore) now require moderator+ (up from admin-only — wider moderation capability with proper role separation)

## [2026.0.101] - 2026-05-14

### Added
- SteamDB version auto-fetch — latest game version/build surfaced in submit wizard version selector
- Landing page: Recently Added Benchmarks, Trending This Week, and Most Tested sections with PlayabilityBadge and performance tags on game cards
- Tiered API rate limiting with 5 categories (auth, read, write, strict, default)
- Comment anti-spam: duplicate detection, 50KB content cap, 30/hr per-user limit
- Submission cooldown: 60-second minimum between benchmark entries per user
- Submission validation hardening: FPS bounds (1-500), TDP bounds, settings size caps, userNotes length cap

### Changed
- Landing page sections reordered: Recently Added Benchmarks → Trending This Week → Most Tested Games
- Landing page cards now show PlayabilityBadge (with text label) and performance tags (Raw Performer / Poor Performance / avg FPS)
- Landing hero height adjusted to `calc(100svh - 10svh)` for content "peek" effect
- Rate limiter now uses named categories instead of a single global bucket

### Security
- Hardened validation on performance entry submission (fps bounds, settings size caps)
- Server-side sanitization of comment content before storage
- Per-route rate limiting categories for granular abuse prevention

## [2026.0.100] - 2026-05-10

### Added
- Screenshot upload during benchmark submission (Review step), gated on settings presence
- Best FPS and performance badges on games list cards
- Game version info and anti-cheat context in preset detail modal
- Auto-computed battery life estimate in submit wizard Review step

### Changed
- Screenshot upload moved from post-submission interstitial into wizard Review step
- Preset detail modal shows game version/build and game-level anti-cheat info

### Removed
- Manual `estimatedBatteryMin` field; all battery estimates now auto-computed from TDP + watt-hours

### Technical
- Dropped `estimated_battery_min` column from `performance_entries`
- Listing API returns `bestFps`, `isRawPerformer`, `isPoorPerformance`
- Updated all component interfaces to remove deprecated battery field

## [2026.0.99] - 2026-05-09

### Added
- Screenshot uploads (1–2 per benchmark entry) with server-side compression and EXIF stripping
- YouTube video linking on performance entries (privacy-enhanced embed)
- Auto-pinning: entries with ≥10 votes and ≥80% approval auto-pin
- Hardware watt-hours (battery capacity) and max TDP fields for battery life estimation
- TDP tracking per performance entry (user-set TDP cap)
- Auto-computed battery life estimates on performance cards and detail view
- Battery Life vs TDP chart on game statistics dashboard
- Mobile filter drawer: slide-out overlay on games list for narrow viewports
- Mobile game cover hero: full-bleed background image with gradient overlay

### Changed
- Performance cards now show TDP/Wh/battery quick-look bar on handheld devices
- Game details hero renders as full-bleed background on mobile (<md) viewports
- Games list filter panel now uses a slide-out drawer on screens below `lg`
- `estimatedBatteryMin` field deprecated in favor of auto-computed values from TDP + device watt-hours

### Fixed
- Games list filter panel no longer overflows the page on mobile

### Technical
- Added `entry_screenshots` database table
- Added `tdpWatts` and `youtubeVideoId` columns to `performance_entries`
- Added `wattHours` and `tdpMax` columns to `hardware`
- Added `sharp` image processing dependency for screenshot compression
- Added on-vote auto-pin trigger in performance vote handlers
- Added `BatteryLifeChart` ECharts component

## [2026.0.98] - 2026-05-09

### Added
- Cloudflare R2 storage integration with upload, delete, and tracking
- Profile photo upload, customization, and deletion (stored in R2)
- Modular daily cron system at `/api/cron/daily` with storage cleanup and sitemap regeneration tasks
- Public data dashboard (`/dashboard`) with trending games, best new releases, and most tested/reported charts
- Advanced search filters on the search page (device, FPS, FSR, Proton, anti-cheat, playability) with saved filter presets
- Admin-only sitemap regeneration endpoint `POST /api/sitemap/regenerate`

### Changed
- Game details page layout restructured: metadata moved inline with hero, system requirements expanded by default
- Improved game details controller navigation (gamepad focusable attributes) and mobile responsiveness
- Switched from dynamic (`force-dynamic`) sitemap generation to build-time static XML files

### Technical
- Added `storage_objects` database table
- Added R2 client module (`lib/storage/`)
- Added `CRON_SECRET` and `R2_*` environment variables; deprecated `S3_*` variables
- Added `build:sitemap` script to `package.json`

## [2026.0.971] - 2026-05-09

### Fixed
- Submit `can't access property "id", (intermediate value).data is undefined`
- Game Card Height in view extending, not fitting actual content.

## [2026.0.97] - 2026-05-06

### Fixed
- Sitemap.xml used ISR caching (`revalidate = 3600`) which poisoned the cache with empty responses on DB hiccups; switched to `force-dynamic` for per-request fresh generation
- DB errors during sitemap generation were silently caught and returned as empty arrays (no games indexed); errors now propagate to observability with structured logging
- Games with NULL `syncStatus` were excluded from sitemap due to SQL `<> 'failed'` returning NULL (not TRUE) for NULL values
- Multi-genre selection in games filter panel only applied the first selected genre; now supports comma-separated OR-matching
- FPS range filter included results from non-active devices; now scoped to the selected device filter when present

### Added
- PWA service worker with offline caching for game pages and images (stale-while-revalidate for HTML, cache-first for Steam CDN images)
- Offline fallback page (`offline.html`) when navigating without network
- Gamepad navigation hook (D-pad/left stick focus, A/B/X/Y buttons, context-aware actions)
- Structured logging for sitemap generation metrics (games, devices, timestamps) via `console.info` JSON
- Filter state synchronized to URL query parameters for shareable/bookmarkable filtered views
- WCAG 2.1 AA touch targets (44×44px) on all games page filter controls

### Changed
- Web manifest icons now declare explicit 192px (maskable) and 512px (any) sizes
- Viewport meta tag added with `viewport-fit=cover` and `user-scalable=no` for installed PWA feel
- Apple mobile web app meta tags added for iOS home screen support
- Loading a saved filter now auto-collapses the filter panel for visual feedback
- Sitemap generation flattened into a single function in `app/sitemap.ts` (removed delegation to `lib/sitemap/`)

### Technical
- Removed `lib/sitemap/fetch-dynamic-entries.ts`, `lib/sitemap/build-static-entries.ts`, `lib/sitemap/validate-image-url.ts`
- Removed `app/api/revalidate-sitemap/` route (no longer needed with `force-dynamic`)
- Added `@serwist/next`, `@serwist/precaching`, `@serwist/sw`, `@serwist/strategies`, `@serwist/expiration`, `@serwist/routing`, and `serwist` dependencies
- Build script updated to use `--webpack` flag for `@serwist/next` compatibility

## [2026.0.96] - 2026-05-01

### Added
- Updates page listing all version release notes
- Update viewer with auto-extracted chapter navigation and reading progress bar
- Markdown-based content pipeline (gray-matter + remark/rehype)
- First update post converted from existing changelog

## [2026.0.95] - 2026-04-30

### Added

#### Anti-Cheat Tracking
- Per-game anti-cheat status display on game details page
- Anti-cheat badges on games list and search results
- Anti-cheat filter in games list
- Anti-cheat awareness step in benchmark submission wizard
- Anti-cheat is game-level property (not per-device)

#### Steam Reviews Integration
- Steam review score badge in game details hero section
- Steam review score display on games list cards
- Steam review score display on search results
- Steam review score and sentiment stored on game records
- Steam review fetching integrated into game sync flow
- Embedded Steam review snippets on game details page
- Steam review score filter in games list (min %)
- Steam review score sort option in games list

#### Playability Indicators
- Auto-calculated playability status (Plays Great / Playable / Needs Tweaks / Unplayable)
- Per-device playability with aggregate game-level status
- Manual override capability for admins/contributors
- Color-coded playability badges across all game views
- "Plays Great" quick-filter in games list
- Auto-recalculates on benchmark submission and Steam sync

#### Games List Revamp
- FPS range filter (min/max)
- FSR support filter
- Proton/Native runtime filter
- Anti-cheat status filter
- Playability status filter
- Steam review score minimum filter
- Free-to-play filter
- Multiplayer filter
- New sort options: Best Performance, Most Popular, Release Date, Steam Reviews
- Saved/bookmarked filter presets

#### Community Suggestions
- "Suggest Edit" button on game details page (non-Steam games only)
- Community suggestion submission for editable fields
- Moderation queue for pending suggestions
- Approve/reject workflow with review notes
- Discord webhook notifications for new suggestions

#### Manage Dashboard
- Overview dashboard replacing simple redirect
- Total games, benchmarks, and users stats cards
- Pending reports and suggestions counters
- 30-day activity metrics
- Top contributors leaderboard
- Playability distribution chart
- Steam sync health overview

#### Benchmark Peer Review
- Enhanced report system for flagging incorrect presets
- Report status tracking (open/reviewed/dismissed)
- Verified badge on peer-reviewed benchmarks

#### Preset Detail Modal
- Added load times (SSD/SD) display
- Added battery life estimate display
- Added custom system indicator

### Changed
- Sync All now processes games in parallel (5 concurrent) instead of one-by-one
- Removed 100-game limit for Sync All (now syncs all Steam games)
- Sync Selected now uses bulk endpoint for faster processing
- Manage page now shows dashboard by default instead of redirecting to users
- Games list now supports 12 filter dimensions and 7 sort options
- Game details page now shows anti-cheat, playability, and Steam reviews prominently
- "Suggest Edit" only appears for non-Steam games (manual, GOG, Epic sources)
- Anti-cheat step in wizard now shows game-level status, not per-device
- Steam sync now sets `syncStatus: "error"` on failure (was missing before)
- Steam sync now handles HTTP 429 rate limiting with Retry-After support
- Steam sync now rejects non-game types (DLC, soundtracks, demos)

### Fixed
- Steam reviews now display correctly (fixed pagination issue with Steam API cursor)
- Steam reviews component now handles missing/error data gracefully
- Anti-cheat badge no longer shows for games without anti-cheat
- Playability calculation only considers anti-cheat if game actually uses it
- API routes registered correctly (removed duplicate `/api` prefix)
- Dashboard and saved-filters routes now accessible
- Sync logic extracted duplicated retry/backoff code into reusable helper

### Technical
- Added `steamReviewScore`, `steamReviewSentiment`, `steamReviewCount` to games table
- Added `playabilityStatus`, `playabilityOverride`, `playabilityCalculatedAt` to games and gamePlatformSupport tables
- Created `community_suggestions` table for moderation workflow
- Created `saved_filters` table for user filter presets
- Added playability auto-calculation engine with `recalculatePlayability()` export
- Added Steam reviews caching API
- Added admin dashboard stats API
- Extracted `recordSyncFailure()` helper for consistent sync error handling

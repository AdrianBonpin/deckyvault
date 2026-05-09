# Changelog

All notable changes to DeckyVault will be documented in this file.

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

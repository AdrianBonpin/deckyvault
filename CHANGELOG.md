# Changelog

All notable changes to DeckyVault will be documented in this file.

## [Unreleased] - 2026-04-30

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

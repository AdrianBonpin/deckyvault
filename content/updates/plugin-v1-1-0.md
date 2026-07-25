---
title: "Plugin v1.1.0 — Library injection, bug fixes, and more"
date: "2026-07-25"
version: "1.1.0"
summary: "DeckyVault plugin now injects performance stats into Steam's library app-details page, plus three bug fixes."
---

## What's new

### Library app-details injection
The DeckyVault plugin now shows a compact stats row on any game's library page (the one with the "Play" button). It auto-detects your device (Steam Deck OLED/LCD) and displays:

- Average FPS, 1% low, min, max
- Average TDP
- Entry count
- A "View Details" button to open the game on DeckyVault

The stats are scoped to your device automatically, falling back to global averages if your device isn't detected.

### New public API
Added `GET /api/plugin/game/:steamAppId` — a public read endpoint that powers the library panel. Returns game status, device-scoped estimated FPS, and top/recent entries. Also includes a `/devices` sub-endpoint for available hardware.

## Bug fixes

- **Recording crash on stop/restart** — Fixed a crash when stopping and immediately restarting a recording while a game is running. The plugin no longer rewrites the MangoHud config mid-game, and log cleanup is scoped to MangoHud files only.
- **FPS validation on resubmit** — Fixed an issue where re-uploading a recording after adding the game to the database would show "FPS must be from 0 to 500". FPS caps raised to 1000, and validation now runs before the game-not-found check so the real error is always visible.
- **Screenshot discovery** — Fixed screenshot picker not finding Game Mode screenshots (Steam+R1). Now scans both `~/Pictures/Screenshots/` and `~/.local/share/Steam/userdata/*/760/remote/*/screenshots/`.
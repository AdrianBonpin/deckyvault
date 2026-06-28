# DeckyVault Decky Loader Plugin — Design Spec

## Overview

A Decky Loader plugin that records Steam Deck (and other Linux handheld) performance metrics during gameplay, then exports or uploads them to DeckyVault as benchmark entries.

The plugin uses **MangoHud** for FPS/power logging, reads **system files** for hardware/OS/Proton detection, and lets the user fill in the few fields that can't be auto-detected (upscaler, frame gen, in-game settings, load times).

## Architecture

```
plugins/decky-vault/src/
├── index.tsx              # Entry point — registers plugin with Decky Loader
├── components/
│   ├── main-panel.tsx     # Record/Stop button, session status, recent recordings
│   ├── session-form.tsx   # Post-session summary with manual inputs + export/upload
│   └── settings-panel.tsx # API key, export path, hardware, MangoHud setup
├── lib/
│   ├── mangohud.ts        # Start/stop MangoHud logging, parse log for FPS stats
│   ├── system-info.ts     # Read hardware model, OS version, Proton version, TDP
│   ├── api-client.ts      # Upload to DeckyVault via API key
│   ├── exporter.ts        # Save .deckyvault.json to disk
│   └── store.ts           # Plugin state (settings, current session, recent sessions)
└── types.d.ts             # Decky Loader API declarations (exists)
```

Each module has one clear purpose:

- **`mangohud.ts`** — writes MangoHud logging config, reads/parses the log file after a session. Computes FPS avg/min/max/1% low and average TDP.
- **`system-info.ts`** — reads `/sys/class/dmi/id/product_name` for hardware detection, `SteamClient.System.GetOSVersion()` for OS, Steam app info for Proton version.
- **`api-client.ts`** — wraps `fetch` calls to DeckyVault's `/api/performance/import` with `x-api-key` header. Also calls `/api/games/lookup` to verify the API key.
- **`exporter.ts`** — builds a `DeckyVaultImportV1` object and writes it as JSON to the configured export path.
- **`store.ts`** — holds plugin settings (API key, export path, hardware override) and session state (recording status, current app ID, start time, parsed results). Also persists the last 5 recent sessions to Decky Loader's plugin storage so they survive plugin reloads. The single source of truth that components read from.

## Recording Flow

### Start Recording

1. User presses "Start Recording" in the plugin panel.
2. Plugin writes a MangoHud config that enables logging. The config sets `output_folder=/tmp`, `output_file=deckyvault-mangohud.log`, and enables: `fps`, `frame_timing`, `cpu_power`, `gpu_power`, `cpu_temp`, `gpu_temp`. MangoHud's log includes a summary section with benchmark percentiles (configurable via `benchmark_percentiles`, default `97,AVG,1,0.1`). The plugin can parse either the raw frame data or the summary section for FPS stats.
3. Plugin records the current timestamp and (if a game is running) the active app ID via `SteamClient.Apps`.
4. Plugin checks if MangoHud is running. If not, shows a warning guiding the user to enable MangoHud for their game (via Steam launch options `mangohud %command%` or the Decky MangoHud toggle). Recording continues regardless — the log file will be populated once MangoHud is active.

### During Recording

- The main panel shows a live status: "Recording — [game name]" with an elapsed timer.
- The MangoHud log file accumulates FPS and power samples in the background.
- User plays their game normally.

### Stop Recording

1. User presses "Stop Recording".
2. Plugin reads the MangoHud log file at `/tmp/deckyvault-mangohud.log` and computes:
   - `fpsAvg` — mean of all FPS samples
   - `fpsLow` — minimum FPS
   - `fpsHigh` — maximum FPS
   - `fpsOnePercentLow` — 1st percentile of frame times, converted to FPS
   - `tdpWatts` — average power draw across samples (if logged)
3. Plugin reads system info:
   - `hardwareSlug` — from `/sys/class/dmi/id/product_name` ("Jupiter" → `steamdeck-lcd`, "Galileo" → `steamdeck-oled`; falls back to user-configured default)
   - `osVersion` — `SteamClient.System.GetOSVersion()`
   - `protonVersion` — from the Steam app info or process environment
4. Plugin transitions to the session summary form.

### Edge Cases

- **No MangoHud log found** → error: "MangoHud logging not detected. Make sure MangoHud is enabled for this game." with a link to the Settings → MangoHud Setup section.
- **Log file is empty** → error: "Recording was too short or MangoHud didn't capture data. Try again."
- **No game running when Record pressed** → allowed, but shows a warning that game info won't be auto-filled. User can still manually enter the Steam App ID in the form.
- **MangoHud log parsing fails** (corrupt/unexpected format) → error with raw log preview, fall back to manual FPS entry in the form.

## Session Summary Form

After stopping, the plugin shows a form with two sections:

### Auto-Captured (read-only summary card)

- Game name + Steam App ID
- FPS: avg / min / 1% low / max
- TDP (watts, average)
- Hardware (e.g. "Steam Deck OLED")
- OS version
- Proton version

### Manual Inputs (user fills in)

| Field | Type | Required | Notes |
|---|---|---|---|
| Upscaler type | dropdown | yes (default: None) | None / FSR / DLSS / XeSS / LSFG / Other |
| Upscaler version | text | no | e.g. "2.4" |
| Frame gen method | dropdown | yes (default: None) | None / FSR FG / DLSS FG / LSFG / Other |
| In-game settings | free text (stored as JSON array) | no | preset, graphics quality, resolution, etc. Maps to `settingsJson` in the import format. |
| Load time (SSD) | number (seconds) | no | |
| Load time (SD card) | number (seconds) | no | |
| Launch options | text | no | auto-filled from Steam if available |
| User notes | textarea | no | max 5000 chars |

### Export / Upload Actions

Two buttons at the bottom of the form:

- **Export to File** — builds a `DeckyVaultImportV1` payload and saves it as `[game-name]-[date].deckyvault.json` to the configured export path.
- **Upload to DeckyVault** — builds the same payload and POSTs to `/api/performance/import` with the `x-api-key` header. Shows success or error response.

Both build the identical `DeckyVaultImportV1` payload. If upload fails (invalid API key, game not in DeckyVault DB, network error), the error message is shown inline and the user can retry or fall back to file export.

## Plugin UI Layout

Two tabs in the Decky Loader Quick Access panel:

### Tab 1: DeckyVault (Main)

**Idle state:**
- Big "Start Recording" button
- Brief instructions: "Enable MangoHud for your game, then press Record before launching."

**Recording state:**
- "Stop Recording" button
- Live elapsed timer
- Current game name (or "No game detected" if none running)

**Stopped state:**
- The session summary form (above) replaces the button area.

**Below (always visible):**
- "Recent recordings" list — last 5 sessions showing game name, FPS avg, date. Clickable to re-view the form and re-export/re-upload.

### Tab 2: Settings

- **API Key** — text input (prefixed `dv_`), with a "Test Key" button that calls `GET /api/games/lookup?steamAppId=0` to verify the key works. Shows ✓ valid or ✗ invalid.
- **Export Path** — text input, defaults to `/home/deck/Downloads`. Where `.deckyvault.json` files are saved.
- **Default Hardware** — auto-detected but overrideable dropdown. Options from `KNOWN_HARDWARE_SLUGS`. Useful for non-standard setups.
- **MangoHud Setup** — see below.

### MangoHud Setup Section

- **"Check MangoHud status" button** — runs `which mangohud` and reports: installed/not installed + version if available.

- **Installation guide** (collapsible):
  - **Steam Deck (SteamOS)**: MangoHud is pre-installed. Enable per-game via Steam launch options (`mangohud %command%`) or the Decky MangoHud toggle plugin.
  - **Other Linux handhelds** (ROG Ally, Legion Go, etc.): install via Flatpak (`flatpak install flathub org.freedesktop.Platform.VulkanLayer.MangoHud`) or system package manager.
  - Link to MangoHud GitHub (`https://github.com/flightlessmango/MangoHud`) for manual builds.

- **Configuration guide** — shows the exact MangoHud config the plugin writes (so users can verify). Includes a "Write config now" button that writes the logging config to `~/.config/MangoHud/MangoHud.conf`.

- **Troubleshooting** (collapsible):
  - Log file empty → check MangoHud is enabled for the game, check the log path.
  - Wrong path → ensure the plugin has write access to `/tmp/`.
  - MangoHud not attaching → try adding `mangohud %command%` to the game's Steam launch options explicitly.

## Data Flow

```
[Start Recording]
      │
      ▼
[MangoHud logs to /tmp/deckyvault-mangohud.log]
      │
      ▼ (user plays game)
[Stop Recording]
      │
      ├──► mangohud.ts parses log → FPS stats, TDP
      ├──► system-info.ts reads → hardware, OS, Proton
      │
      ▼
[Session Summary Form]
      │ (user fills manual fields)
      ├──► exporter.ts → .deckyvault.json on disk
      └──► api-client.ts → POST /api/performance/import
                                    │
                                    ▼
                          [DeckyVault database]
```

## Error Handling

- **MangoHud not installed** → Settings tab shows installation guide. Main tab warns when Record is pressed.
- **MangoHud not enabled for game** → post-session error with link to Settings → MangoHud Setup.
- **Invalid API key** → upload fails with 401, message shown in form. User directed to Settings to re-enter key.
- **Game not in DeckyVault DB** → upload returns 404, message: "This game isn't in DeckyVault yet. Submit it on the website first, or export to file for now."
- **Network error during upload** → message shown, user can retry or export to file.
- **Filesystem write error (export)** → message: "Couldn't write to [path]. Check the path in Settings."

## Testing

Since the plugin runs on Steam Deck hardware in the Decky Loader environment, testing is primarily manual:

1. **MangoHud log parsing** — unit-testable with sample log files. Create test fixtures of MangoHud CSV output and verify FPS computation.
2. **System info reading** — testable on any Linux machine with mock `/sys` files.
3. **API client** — testable with mock fetch responses (success, 401, 404, network error).
4. **Exporter** — testable by writing to a temp directory and verifying JSON structure matches `DeckyVaultImportV1`.
5. **End-to-end** — manual testing on a Steam Deck with MangoHud enabled, recording a game session and verifying upload/export.

## Dependencies

- `@deckyvault/shared` — workspace package (types: `DeckyVaultImportV1`, `KNOWN_HARDWARE_SLUGS`)
- React — provided by Decky Loader runtime
- MangoHud — external dependency, must be installed by the user (pre-installed on Steam Deck)

## Out of Scope (for this phase)

- Auto-detection of upscaler / frame gen / in-game settings (manual input only)
- Automatic recording on game start (manual start/stop only)
- Real-time performance overlay in the plugin (MangoHud already provides this)
- Multi-session batch upload (one session at a time)
- Support for non-Steam games (requires manual Steam App ID entry, which is handled in the form)
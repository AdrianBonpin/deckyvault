# Plugin Bugs + Features — Design

**Date:** 2026-07-12
**Scope:** Decky Loader plugin (`plugins/decky-vault`) + DeckyVault web API (`apps/web/lib/api`). Three bug fixes and two features, unified in one spec.
**No DB migrations required** — all changes reuse existing schema columns and routes.

---

## 1. Background & decisions (from brainstorm)

### Bugs
1. **Stop/restart recording can crash the game.** Root cause: `handleStart` calls `write_mangohud_config()` (rewrites `~/.config/MangoHud/MangoHud.conf`) and `clear_mangohud_log()` (deletes `/tmp/*MangoHud*`, `/tmp/*.csv`, **and `/tmp/*.log`**) on **every** start, even while MangoHud is running as the game's wrapper. Rewriting a live config + deleting a file the wrapper has open can crash MangoHud, which takes the game with it.
2. **"FPS must be from 0 to 500" on resubmit.** Root causes: (a) `buildImportPayload` sends `fpsAvg: sess.fpsAvg ?? 0` — a failed/short recording with no parsed FPS submits `0`, failing the server's `fpsAvg < 1` check; (b) the server caps **all** FPS fields at 500 — `fpsHigh` (and even `fpsAvg`) can legitimately exceed 500 in menus/2D games; (c) the game-not-found (404) check runs *before* FPS validation in `performance-import.ts`, so the first submit masks the real FPS error and it only surfaces after the user adds the game to the DB.
3. **Photos does not pull screenshots.** Root cause: `list_screenshots` only scans `~/Pictures/Screenshots/` + `Steam Client/` (the Desktop Mode export path). Game Mode (Steam+R1) saves to `~/.local/share/Steam/userdata/<steamId>/760/remote/<appId>/screenshots/*.jpg`, which is never discovered.

### Features (unified into one injection surface)
4. **Game-open → show game entry, top entries, est FPS.**
5. **Library focus → inject device-filtered metrics.**

**Feasibility finding:** `definePlugin` (in our installed `@decky/api@1.1.3` / `@decky/ui@4.11.6`) only exposes a single QAM content panel — there is no `tabs`/`gameTabs` field. However, Decky's **documented** `routerHook.addPatch('/library/app/:appid', patch)` + `createReactTreePatcher` / `afterPatch` / `findInReactTree` / `appDetailsClasses` (all exported by our installed packages; verified) enable injecting a React section into the library/app-details page — the same canonical pattern used by the maintained `HLTB for Deck` plugin. This is **not** raw fragile monkey-patching; it is the supported route-patch API.

**Unified design:** Both features become a single DeckyVault section injected onto the game's library/app-details page. No new in-QAM tab. The section shows: game entry status, device-scoped est FPS, and top recent/pinned/most-positive entries (3 cards).

**Decisions locked during brainstorm:**
- Feature 5 surface: `A` — library app-details section via `routerHook.addPatch` (HLTB pattern), guarded so a Steam UI change degrades silently.
- Feature 4 (no in-panel tab): fold into the same injection.
- "Est FPS (based on global)": **device-scoped** to the detected hardware slug (matches Feature 5).
- Device scope control: **D1** — default to detected device, with a small in-section dropdown to switch device or view "All devices".
- Bug 2 handling: **A** — plugin clamps/guards before submit; server raises FPS caps to 1000; NaN still rejected.

---

## 2. Bug fixes — detailed design

### 2.1 Bug 1 — safe recording start

**Plugin frontend (`src/index.tsx` → `handleStart`):**
- Remove `await writeMangohudConfig()`. Config is a one-time setup step already exposed via the "Write Config" button in the MangoHud Setup panel. The hot start path must never rewrite a config a live game is using.

**Plugin backend (`main.py` → `clear_mangohud_log`):**
Rework to be MangoHud-specific and non-destructive of live/foreign files:
- Globs to delete: `/tmp/*MangoHud*` and `/tmp/*MangoHud*.csv` only. **Never** `/tmp/*.log` (system/foreign logs). **Never** bare `/tmp/*.csv` (could belong to other tools).
- Skip any candidate whose `mtime` is within the last 3 seconds (an active session may still have it open).
- Return `{ success, deleted: [{name}], skipped: [{name, reason}] }` for observability.

**Recording-specific log tracking (frontend + backend):**
- On `handleStop`, after `readAndParseMangohudLog`, store the resolved log path in `session.lastLogPath`.
- On next `handleStart`, if `session.lastLogPath` is known, delete (or rename to `*.bak`) **that specific file** only; otherwise fall back to the safe `clear_mangohud_log` above.
- Add a new lightweight RPC `delete_log_file(path)` that strictly validates the path is under `/tmp` and matches `*MangoHud*` before removal (defence in depth).

**Tests (`tests/test_clear_log.py`, new):**
- Only `*MangoHud*` files removed; a `/tmp/system.log` and `/tmp/other.csv` untouched.
- A file with `mtime` < 3s ago is skipped.
- `delete_log_file` rejects paths outside `/tmp` or not matching `*MangoHud*`.

### 2.2 Bug 2 — FPS validation/caps + ordering

**Plugin frontend (`src/lib/store.ts` → `buildImportPayload`):**
- If `sess.fpsAvg == null` or `<= 0`: the caller (`session-form.tsx` `handleUpload`) must block upload with `setError("No FPS data captured — re-record or export only.")` and **not** call `uploadToDeckyvault`. (Export-to-file remains allowed.)
- Clamp: negatives → 0; `fpsHigh`/`fpsAvg`/`fpsLow`/`fpsOnePercentLow` capped at 1000 before sending (server-side cap matches).
- Remove the `?? 0` fallback for `fpsAvg`; use `null` and let the guard above handle it. New helper `sanitizeFps(value)`.

**Server (`apps/web/lib/api/performance-import.ts`):**
- Reorder validation: validate **FPS shape first** (non-NaN, range), then hardware, then game-not-found. Rationale: the user should always see the *real* first error regardless of DB state; a 404 must not mask a 400.
- Raise caps to 1000 for `fpsAvg`, `fpsLow`, `fpsOnePercentLow`, `fpsHigh`. Keep rejecting `NaN`. Lower bounds unchanged (`fpsAvg` ≥ 1, others ≥ 0).
- Apply the same changes to `apps/web/lib/api/performance-submit.ts` (the website submit path) for parity.

**Tests (`apps/web/lib/api/__tests__/performance-import.test.ts`, new/extended):**
- No-data payload (`fpsAvg` missing/null) → 400 with a clear message, never a silent 0.
- `fpsHigh: 750` → 201 (accepted), not 400.
- `fpsAvg: NaN` → 400.
- Validation ordering: a payload that is *both* game-not-found *and* has invalid FPS returns the FPS error (400) first.

### 2.3 Bug 3 — screenshot discovery

**Plugin backend (`main.py` → `list_screenshots`):**
Add the Game Mode path and keep existing paths (Desktop Mode export):
- New globs: `~/.local/share/Steam/userdata/*/760/remote/*/screenshots/*.{jpg,png}` (all Steam accounts).
- Existing globs retained: `~/Pictures/Screenshots/*.{jpg,png}` + `Steam Client/*.{jpg,png}`; skip `most_recent.jpg` duplicate as today.
- Merge all, de-duplicate by real path (not just basename), sort by `mtime` desc, slice to `limit`.
- Optional new param `app_id: int | None`: when provided, prefer that app's folder (still include Desktop exports) and tag each screenshot with `{ appId }` in the response so the picker can group/filter.

**`read_screenshot` (`main.py`):**
- Existing Pillow downscale to `max_width` stays.
- Add a pure-Python fallback when Pillow is absent: if raw size < 1 MB, return the data URL; if ≥ 1 MB, return `{ dataUrl: "", error: "Preview unavailable (too large, no Pillow)" }` so CEF is never handed a giant buffer. The picker will show the placeholder thumbnail + name; upload still works (upload reads the file directly, not the preview).

**Tests (`tests/test_screenshots.py`, new):**
- A fixture tree with `~/Pictures/Screenshots/x.jpg`, `~/Pictures/Screenshots/Steam Client/y.jpg`, and `~/.local/share/Steam/userdata/<id>/760/remote/<appid>/screenshots/z.jpg` → all three returned, deduped, sorted by mtime.
- `app_id` filter returns only that app's folder screenshots + Desktop exports.
- Fallback `read_screenshot` behaviour under a `PIL ImportError` mock: under 1 MB returns data URL, over 1 MB returns preview-unavailable but no exception.

---

## 3. Features 4 & 5 — library app-details DeckyVault section

### 3.1 Injection mechanism

A new module `plugins/decky-vault/src/patches/LibraryApp.tsx` registers a route patch on plugin load and unpatches on dismount, mirroring `HLTB for Deck`'s `patchAppPage`:

```ts
// sketch (real impl in the plan)
routerHook.addPatch('/library/app/:appid', (routerTree) => {
  const routeProps = findInReactTree(routerTree, (x) => x?.renderFunc);
  if (!routeProps) return routerTree;            // guard: unexpected tree → no-op
  afterPatch(routeProps, 'renderFunc', createReactTreePatcher(
    [(tree) => {
      const child = findInReactTree(tree, (x) => x?.props?.children?.props?.overview);
      if (!child) return null;                   // guard: not a game page
      const overview = child.props.children.props.overview;
      if (!isSteamGameType(overview.app_type)) return null; // only real games (1/8)
      return child.props.children;
    }],
    (_, ret) => {
      const container = findInReactTree(ret,
        (x) => Array.isArray(x?.props?.children) &&
              x?.props?.className?.includes(appDetailsClasses.InnerContainer));
      const arr = container?.props?.children;
      const idx = arr?.findIndex(/* locate the splicable anchor, HLTB-style */);
      if (idx > -1) arr.splice(idx, 0, <LibraryAppPanel appId={overview.appid} title={overview.display_name} />);
      return ret;
    }
  ));
  return routerTree;
});
```

**Guardrails (critical):**
- Every `findInReactTree` / array access is null-checked; a missing anchor logs a `console.debug` and returns the tree unmodified (no crash, no splice). Non-game pages (soundtracks, tools) are skipped via `app_type`.
- The injected component is async and self-contained — fetch failures render a tiny "DeckyVault: unavailable" line or nothing, never a thrown error in the tree.
- `onDismount` calls `routerHook.removePatch('/library/app/:appid', patch)`.

### 3.2 Injected component — `LibraryAppPanel.tsx`

Props: `{ appId: number, title: string }`. Behaviour:
- Reads the plugin's detected `hardwareSlug` (via a shared store accessor) for the default device scope.
- Fetches `GET /api/plugin/game/:steamAppId?hardware=<slug>&limit=3` (see 3.4).
- Caches the response per `appId` in an in-memory LRU (1h TTL) to avoid refetch on every page re-render.
- Renders, inside a Steam-styled container (uses `appDetailsClasses` + `staticClasses`):
  1. **Game entry status** — "In DeckyVault" with a link button (decky `Router.NavigateToURL` gloss) or "Not in DeckyVault — open this game on deckyvault.xyz to add it." CTA when the API returns 404 / `game == null`.
  2. **Est FPS** — device-scoped by default (the detected slug), with a compact device **dropdown** (D1): options = detected device + "All devices" + other devices returned by the optional `/devices` endpoint. Switching the dropdown re-fetches with the new `hardware` query.
  3. **Top 3 entry cards** — pinned / top-upvoted / most-recent, each expandable to show `settingsJson` summary, upscaler/frame-gen, Proton/OS, TDP, and the contributor. Reuses fields already returned by the existing performance endpoint shape.
  4. **Empty state** — "No entries for your device yet — be the first: open the DeckyVault plugin and record." when the game exists but the device scope has no data.

### 3.3 Plugin data fetching

`plugins/decky-vault/src/lib/plugin-api.ts` (new) provides typed fetch helpers. Since CEF fetch from Steam's context to `deckyvault.xyz` can be CORS-restricted, we proxy through the Python backend as a reliable fallback:
- Python (`main.py`) gains a small generic RPC `plugin_get(path: str) -> dict` that does an authenticated (none needed — reads are public) `urllib` GET to `${base_url}/api${path}` with the existing SSL fallback, returning parsed JSON or `{ error, status }`. Keeps all network in one place, matches the existing upload pattern.
- TS helper wraps `callable("plugin_get")`, caches in the same LRU.

### 3.4 New web API — read-only, public

New module `apps/web/lib/api/plugin-public.ts`, mounted in `apps/web/lib/api/app.ts`:

- `GET /api/plugin/game/:steamAppId?hardware=<slug|null>&limit=<n>`
  - Resolves the game by `steamAppId` (reuses the existing `games-lookup` resolution). Returns `{ game: {...}|null, estFps: {avg, low, onePct, high, count}|null, topEntries: [...], recentEntries: [...] }`.
  - `hardware` optional: when a valid slug, scope `estFps` + entries to that device; when omitted/null, all devices.
  - `topEntries` = entries ordered by `isPinned desc, upvotes desc` (existing behaviour), sliced to `limit`.
  - `recentEntries` = entries ordered by `createdAt desc`, sliced to `limit`.
  - `estFps` = aggregates over the (device-scoped) non-removed entries using `avg()`/`min()`/`max()`/`count()` on `performanceEntries` (patterns already used in `dashboard-public.ts`, `hardware-stats.ts`, `compare.ts`).
  - Entry shape reuses the `games-performance.ts` row projection (trimmed: id, hardware, fpsAvg/Low/OnePct/High, upscalerType, frameGenMethod, protonVersion, osVersion, tdpWatts, settingsJson, upvotes, isPinned, createdAt, userName, userImage).
  - Public (no API key) — community data is already public on the site. Same rate-limit middleware as other public routes.

- `GET /api/plugin/game/:steamAppId/devices` (optional, drives the dropdown)
  - Returns `[{ slug, name, count }]` for hardware slugs with ≥1 non-removed entry for the game.

**Tests (`apps/web/lib/api/__tests__/plugin-public.test.ts`, new):**
- Game in DB, `hardware=steamdeck-oled` → device-scoped est FPS + entries.
- `hardware` omitted → all-device scope.
- Game not in DB → 404 with `{ game: null }` plus an `error` string (so the panel shows its CTA).
- `limit` honoured; `devices` endpoint returns only slugs with data.

### 3.5 Activation wiring

`plugins/decky-vault/src/index.tsx`:
- On `definePlugin` body: create the patch (`patchAppPage()`) and keep its handle.
- `onDismount`: `routerHook.removePatch('/library/app/:appid', handle)` (plus existing cleanup).
- The existing QAM panel (`Content`) stays as-is (Recording → Session Results flow unchanged except Bug 1/2 fixes).

---

## 4. Cross-cutting: error handling, caching, testing

**Error handling:**
- Library patch: never throws into Steam's tree; every external call is wrapped; render falls back to null/CTA.
- API: standard Elysia error shapes (`{ error }`); 404 for unknown game; 400 only for malformed query.
- Plugin uploads: Bug 2 guard blocks before network call.

**Caching:**
- Plugin-side per-appid LRU (1h) for library panel reads.
- API: `Cache-Control: public, max-age=60` on the read endpoints (community data, acceptable staleness).

**Testing summary:**
- Python pytest: Bug 1 safe-clear + `delete_log_file`; Bug 3 screenshot discovery + fallback.
- Vitest (web API): `performance-import` validation ordering + 1000 caps; `plugin-public` contract + device scope + 404.
- Plugin TS: `buildImportPayload` clamp/null guard (unit if harness present, else build + manual smoke). No DB migrations.

---

## 5. Files touched

**Plugin:**
- `plugins/decky-vault/main.py` — `clear_mangohud_log`, new `delete_log_file`, `list_screenshots`, `read_screenshot`, new `plugin_get`.
- `plugins/decky-vault/src/index.tsx` — `handleStart` cleanup; wire patch + `onDismount`.
- `plugins/decky-vault/src/lib/store.ts` — `buildImportPayload` clamp/null guard + `sanitizeFps`.
- `plugins/decky-vault/src/lib/api.ts` — new `pluginGet` RPC wrapper.
- `plugins/decky-vault/src/lib/plugin-api.ts` (new) — typed library-panel fetch helpers + cache.
- `plugins/decky-vault/src/patches/LibraryApp.tsx` (new) — `routerHook.addPatch` splicer.
- `plugins/decky-vault/src/components/LibraryAppPanel.tsx` (new) — injected section UI.
- `plugins/decky-vault/tests/test_clear_log.py`, `tests/test_screenshots.py` (new) + fixtures.

**Web API:**
- `apps/web/lib/api/performance-import.ts`, `performance-submit.ts` — caps (1000) + validation order.
- `apps/web/lib/api/plugin-public.ts` (new) — mounted in `app.ts`.
- `apps/web/lib/api/__tests__/performance-import.test.ts`, `plugin-public.test.ts` (new/extended).

**No schema changes, no migrations.**

---

## 6. Out of scope

- Any Decky store submission / release packaging.
- The in-QAM "new tab" concept (dropped per user decision — folded into library injection).
- Toast / grid-focus overlays (feature 5 option B, dropped).
- Per-entry rich-text comments rendering inside the library panel (future enhancement).
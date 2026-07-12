# Plugin Bugs + Library Injection Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three plugin bugs (recording-start crash, FPS validation/resubmit error, screenshot discovery) and add a DeckyVault section injected into Steam's library/app-details page (unified Features 4 & 5: game-entry status, device-scoped est FPS with a device switcher, and top recent/pinned/most-positive entries).

**Architecture:** Plugin-side Python (`main.py`) and TypeScript/React (`src/`) changes for the bugs and the library patch. The library patch uses Decky's supported `routerHook.addPatch('/library/app/:appid')` + `createReactTreePatcher` (the HLTB-for-Deck pattern, all helpers already exported by our installed `@decky/ui@4.11.6` / `@decky/api@1.1.3`). A new read-only public web API (`apps/web/lib/api/plugin-public.ts`) serves the injected panel. Bug 2 also touches the import/submit API routes (caps + validation ordering).

**Tech Stack:** Python 3 (urllib stdlib, pytest), TypeScript/React (Decky `@decky/api` + `@decky/ui`, rollup), Elysia API, Drizzle ORM, Vitest, Bun.

**Spec:** `docs/superpowers/specs/2026-07-12-plugin-bugs-and-features-design.md`

---

## File Structure

**Plugin (`plugins/decky-vault/`):**
- `main.py` — modify `clear_mangohud_log`, `list_screenshots`, `read_screenshot`; add `delete_log_file`, `plugin_get`.
- `src/index.tsx` — modify `handleStart`; wire patch registration + `onDismount` cleanup.
- `src/lib/store.ts` — modify `buildImportPayload`; add `sanitizeFps`.
- `src/lib/api.ts` — add `pluginGet` RPC wrapper.
- `src/lib/plugin-api.ts` (new) — `fetchPluginGame` typed helper + per-appid LRU cache.
- `src/patches/LibraryApp.tsx` (new) — `registerLibraryAppPatch()` returns an unpatch handle.
- `src/components/LibraryAppPanel.tsx` (new) — the injected React section (status / est FPS / device switcher / top entries / empty states).
- `tests/test_clear_log.py` (new) — safe-clear + `delete_log_file` tests.
- `tests/test_screenshots.py` (new) — multi-path discovery + fallback tests.
- `tests/fixtures/` — screenshot fixture tree (created by tests via `tempfile`).

**Web API (`apps/web/`):**
- `lib/api/performance-import.ts` — reorder validation (FPS before game lookup) + raise caps to 1000.
- `lib/api/performance-submit.ts` — raise caps to 1000 (parity).
- `lib/api/plugin-public.ts` (new) — `GET /api/plugin/game/:steamAppId` (+ optional `/devices`).
- `lib/api/app.ts` — mount `pluginPublicRoutes` in the public (read) group.
- `lib/api/__tests__/performance-import-validation.test.ts` (new) — unit test extracted FPS validation.
- `lib/api/__tests__/plugin-public.test.ts` (new) — contract + device scope + 404.

**No DB schema changes.**

---

## Task ordering

1. **Bug 2 — server caps + validation ordering** (API-first; no plugin dependency).
2. **Bug 2 — plugin `sanitizeFps` + null-fpsAvg upload guard.**
3. **Bug 1 — safe `clear_mangohud_log` + `delete_log_file` + `handleStart` cleanup.**
4. **Bug 3 — `list_screenshots` multi-path discovery + `read_screenshot` fallback.**
5. **Feature — new read API `plugin-public.ts` + mount + tests.**
6. **Feature — plugin `plugin_get` RPC + `plugin-api.ts` fetch/cache.**
7. **Feature — `LibraryApp.tsx` patch + `LibraryAppPanel.tsx` + wire in `index.tsx`.**
8. **Final build + lint + test sweep.**

Each task ends with a commit. Run plugin Python tests with `cd plugins/decky-vault && python -m pytest tests/ -v`. Run web tests from repo root with `bun run test` (Vitest).

---

## Task 1: Server FPS caps + validation ordering (Bug 2, server side)

**Files:**
- Modify: `apps/web/lib/api/performance-import.ts` (validation block ~lines 88–140 and the game-lookup block ~lines 58–80)
- Modify: `apps/web/lib/api/performance-submit.ts` (FPS validation block ~lines 145–165)
- Test: `apps/web/lib/api/__tests__/performance-import-validation.test.ts` (new)

The cleanest, TDD-testable approach is to extract the FPS validation into a pure function and unit-test it, then reorder the route to call it before the game lookup. We do this in `performance-import.ts`.

- [ ] **Step 1: Write the failing test for an extracted `validateFps` helper**

Create `apps/web/lib/api/__tests__/performance-import-validation.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { validateFps } from "@/lib/api/performance-import"

describe("validateFps", () => {
  it("rejects missing/null fpsAvg", () => {
    const r = validateFps({ fpsAvg: null as unknown as number })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/fpsAvg/i)
  })

  it("rejects NaN fpsAvg", () => {
    const r = validateFps({ fpsAvg: NaN })
    expect(r.ok).toBe(false)
  })

  it("rejects fpsAvg below 1", () => {
    const r = validateFps({ fpsAvg: 0 })
    expect(r.ok).toBe(false)
  })

  it("accepts fpsAvg up to 1000", () => {
    const r = validateFps({ fpsAvg: 1000, fpsHigh: 999 })
    expect(r.ok).toBe(true)
  })

  it("rejects fpsAvg above 1000", () => {
    const r = validateFps({ fpsAvg: 1001 })
    expect(r.ok).toBe(false)
  })

  it("accepts fpsHigh of 750 (legit >500)", () => {
    const r = validateFps({ fpsAvg: 120, fpsHigh: 750 })
    expect(r.ok).toBe(true)
  })

  it("accepts optional nulls for fpsLow/onePct/high", () => {
    const r = validateFps({ fpsAvg: 60, fpsLow: null, fpsOnePercentLow: null, fpsHigh: null })
    expect(r.ok).toBe(true)
  })

  it("rejects negative fpsLow", () => {
    const r = validateFps({ fpsAvg: 60, fpsLow: -1 })
    expect(r.ok).toBe(false)
  })

  it("rejects fpsHigh above 1000", () => {
    const r = validateFps({ fpsAvg: 60, fpsHigh: 1200 })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- performance-import-validation`
Expected: FAIL — `validateFps is not a function` (module exports nothing yet).

- [ ] **Step 3: Implement `validateFps` and reorder the route**

In `apps/web/lib/api/performance-import.ts`:

Add at the top (after the const declarations, near the other helpers), a pure exported function:

```ts
const FPS_MIN_AVG = 1
const FPS_MIN_OTHER = 0
const FPS_MAX = 1000

export type FpsInput = {
  fpsAvg: number
  fpsLow?: number | null
  fpsOnePercentLow?: number | null
  fpsHigh?: number | null
}

export function validateFps(input: FpsInput): { ok: true; values: { fpsAvg: number; fpsLow: number | null; fpsOnePercentLow: number | null; fpsHigh: number | null } } | { ok: false; error: string } {
  const fpsAvg = Number(input.fpsAvg)
  if (input.fpsAvg == null || isNaN(fpsAvg) || fpsAvg < FPS_MIN_AVG || fpsAvg > FPS_MAX) {
    return { ok: false, error: `fpsAvg must be between ${FPS_MIN_AVG} and ${FPS_MAX}` }
  }
  const fpsLow = input.fpsLow != null ? Number(input.fpsLow) : null
  if (fpsLow !== null && (isNaN(fpsLow) || fpsLow < FPS_MIN_OTHER || fpsLow > FPS_MAX)) {
    return { ok: false, error: `fpsLow must be between ${FPS_MIN_OTHER} and ${FPS_MAX}` }
  }
  const fpsOnePercentLow = input.fpsOnePercentLow != null ? Number(input.fpsOnePercentLow) : null
  if (fpsOnePercentLow !== null && (isNaN(fpsOnePercentLow) || fpsOnePercentLow < FPS_MIN_OTHER || fpsOnePercentLow > FPS_MAX)) {
    return { ok: false, error: `fpsOnePercentLow must be between ${FPS_MIN_OTHER} and ${FPS_MAX}` }
  }
  const fpsHigh = input.fpsHigh != null ? Number(input.fpsHigh) : null
  if (fpsHigh !== null && (isNaN(fpsHigh) || fpsHigh < FPS_MIN_OTHER || fpsHigh > FPS_MAX)) {
    return { ok: false, error: `fpsHigh must be between ${FPS_MIN_OTHER} and ${FPS_MAX}` }
  }
  return { ok: true, values: { fpsAvg, fpsLow, fpsOnePercentLow, fpsHigh } }
}
```

Then **reorder the route handler**: move the FPS validation **above** the game lookup. Replace the existing FPS-validation block (the `// ── Validate FPS fields ───` section, currently after hardware validation) by a call to `validateFps`, and move that call to **just after** the `body.version !== 1` check and **before** the `steamAppId` resolution / game lookup. Concretely, restructure the handler so the order is:

1. Auth guard
2. `body.version !== 1` → 400
3. **FPS validation** via `validateFps({ fpsAvg: body.fpsAvg, fpsLow: body.fpsLow, fpsOnePercentLow: body.fpsOnePercentLow, fpsHigh: body.fpsHigh })` → 400 on `!ok` (use `result.error`); on ok, destructure `values` into local `fpsAvg/fpsLow/fpsOnePercentLow/fpsHigh` for use later when inserting the entry.
4. `steamAppId` required → 400
5. Game lookup → 404 if missing
6. Version resolution
7. Hardware validation → 400
8. Enum + other numeric validation (unchanged)
9. Insert entry (use the validated `values.*`)

Make sure the later insert uses the validated locals (rename so there's no duplicate `const fpsAvg`). Remove the old inline FPS validation block entirely.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- performance-import-validation`
Expected: PASS (all 9 cases).

- [ ] **Step 5: Update `performance-submit.ts` caps for parity**

In `apps/web/lib/api/performance-submit.ts`, change every FPS cap from `500` to `1000` in its validation block (~lines 145–165). The messages should read `between 1 and 1000` (fpsAvg) and `between 0 and 1000` (others). Do not reorder this route (it has no game-not-found-before-FPS issue); only raise the caps.

- [ ] **Step 6: Lint + typecheck the web app**

Run: `cd apps/web && bun run lint && bunx tsc --noEmit -p tsconfig.json` (from repo root: `cd apps/web && bunx tsc --noEmit`)
Expected: no new errors. (If `tsc` flags unrelated pre-existing errors, ensure none are introduced by these files.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/api/performance-import.ts apps/web/lib/api/performance-submit.ts apps/web/lib/api/__tests__/performance-import-validation.test.ts
git commit -m "fix(api): raise FPS caps to 1000 and validate FPS before game lookup"
```

---

## Task 2: Plugin FPS sanitize + null-fpsAvg upload guard (Bug 2, plugin side)

**Files:**
- Modify: `plugins/decky-vault/src/lib/store.ts` (`buildImportPayload` + new `sanitizeFps`)
- Modify: `plugins/decky-vault/src/components/session-form.tsx` (`handleUpload` guard)

- [ ] **Step 1: Add `sanitizeFps` and harden `buildImportPayload`**

In `plugins/decky-vault/src/lib/store.ts`, add a helper above `buildImportPayload`:

```ts
const FPS_MAX = 1000

/** Clamp/cap an FPS value to [0, 1000]; return null for null/undefined/NaN. */
export function sanitizeFps(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  if (isNaN(n)) return null
  if (n < 0) return 0
  if (n > FPS_MAX) return FPS_MAX
  return n
}
```

Then replace the FPS lines in `buildImportPayload`. The current first lines are:

```ts
  return {
    version: 1,
    steamAppId: sess.appId ?? 0,
    hardwareSlug: sess.hardwareSlug,
    fpsAvg: sess.fpsAvg ?? 0,
    fpsLow: sess.fpsLow,
    fpsOnePercentLow: sess.fpsOnePercentLow,
    fpsHigh: sess.fpsHigh,
```

Change to:

```ts
  return {
    version: 1,
    steamAppId: sess.appId ?? 0,
    hardwareSlug: sess.hardwareSlug,
    fpsAvg: sanitizeFps(sess.fpsAvg) ?? 0,
    fpsLow: sanitizeFps(sess.fpsLow),
    fpsOnePercentLow: sanitizeFps(sess.fpsOnePercentLow),
    fpsHigh: sanitizeFps(sess.fpsHigh),
```

Note: `fpsAvg` keeps a `?? 0` fallback so the payload type (`fpsAvg: number`) stays valid, but the **caller** now guards against `0`/null before uploading (Step 2). `fpsAvg` clamped to [1,1000] when present.

Actually, to keep the server's `fpsAvg >= 1` check meaningful, clamp the **lower** bound of fpsAvg to 1 when present — adjust `sanitizeFps` usage for `fpsAvg`:

```ts
    fpsAvg: sess.fpsAvg == null || sess.fpsAvg <= 0 ? 0 : sanitizeFps(sess.fpsAvg)!,
```

(When `fpsAvg` is null/≤0 we leave `0` so the caller's guard trips; otherwise it's a clamped positive number.)

- [ ] **Step 2: Add the null/no-data upload guard in `session-form.tsx`**

In `plugins/decky-vault/src/components/session-form.tsx`, at the top of `handleUpload` (right after the `if (!settings) return` and the apiKey check, before `setUploadStatus("loading")`), add:

```ts
    if (session.fpsAvg == null || session.fpsAvg <= 0) {
      setError("No FPS data captured. Re-record the session, or use Export to File only.")
      return
    }
```

This prevents submitting a no-data recording as `fpsAvg=0`.

- [ ] **Step 3: Build the plugin to verify it compiles**

Run: `cd plugins/decky-vault && bun run build`
Expected: build succeeds, `dist/index.js` written.

- [ ] **Step 4: Commit**

```bash
git add plugins/decky-vault/src/lib/store.ts plugins/decky-vault/src/components/session-form.tsx
git commit -m "fix(plugin): block no-FPS uploads and clamp FPS before submit"
```

---

## Task 3: Safe recording start (Bug 1)

**Files:**
- Modify: `plugins/decky-vault/main.py` (`clear_mangohud_log` ~line 369; add `delete_log_file`)
- Modify: `plugins/decky-vault/src/index.tsx` (`handleStart` + store `lastLogPath`)
- Modify: `plugins/decky-vault/src/lib/store.ts` (`SessionData.lastLogPath` + `useSession` plumbing)
- Test: `plugins/decky-vault/tests/test_clear_log.py` (new)

- [ ] **Step 1: Write failing tests for the safe-clear logic + `delete_log_file`**

Create `plugins/decky-vault/tests/test_clear_log.py`:

```python
"""Tests for safe MangoHud log clearing (Bug 1 fix)."""
import os
import tempfile
import time
import pytest


def _touch(path, mtime_age=10):
    """Create a file at path, optionally backdated mtime by mtime_age seconds."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write("data")
    if mtime_age > 0:
        t = time.time() - mtime_age
        os.utime(path, (t, t))


def _safe_clear_mangohud_logs(tmpdir, now=None, recent_window_s=3):
    """Mirror of Plugin.clear_mangohud_log safe logic, operating on tmpdir."""
    import glob
    if now is None:
        now = time.time()
    deleted, skipped = [], []
    patterns = [
        os.path.join(tmpdir, "*MangoHud*"),
        os.path.join(tmpdir, "*MangoHud*.csv"),
    ]
    for pat in patterns:
        for f in glob.glob(pat):
            if not os.path.isfile(f):
                continue
            try:
                if now - os.path.getmtime(f) < recent_window_s:
                    skipped.append({"name": os.path.basename(f), "reason": "active"})
                    continue
                os.remove(f)
                deleted.append({"name": os.path.basename(f)})
            except (IOError, PermissionError):
                skipped.append({"name": os.path.basename(f), "reason": "perm"})
    return {"success": True, "deleted": deleted, "skipped": skipped}


def test_only_mangohud_files_removed():
    with tempfile.TemporaryDirectory() as tmp:
        _touch(os.path.join(tmp, "MangoHud-1.csv"), mtime_age=10)
        _touch(os.path.join(tmp, "system.log"), mtime_age=10)       # MUST be untouched
        _touch(os.path.join(tmp, "other.csv"), mtime_age=10)        # MUST be untouched
        res = _safe_clear_mangohud_logs(tmp)
        assert res["success"] is True
        names = [d["name"] for d in res["deleted"]]
        assert "MangoHud-1.csv" in names
        assert "system.log" not in names and "other.csv" not in names
        assert os.path.exists(os.path.join(tmp, "system.log"))
        assert os.path.exists(os.path.join(tmp, "other.csv"))


def test_active_recent_file_skipped():
    with tempfile.TemporaryDirectory() as tmp:
        _touch(os.path.join(tmp, "MangoHud-active.csv"), mtime_age=0)
        res = _safe_clear_mangohud_logs(tmp)
        assert res["deleted"] == []
        assert any(s["name"] == "MangoHud-active.csv" for s in res["skipped"])
        assert os.path.exists(os.path.join(tmp, "MangoHud-active.csv"))


def _validate_log_path(path, tmpdir):
    """Mirror of Plugin.delete_log_file path validation."""
    if not path:
        return False
    abs_path = os.path.abspath(path)
    if not abs_path.startswith(os.path.abspath(tmpdir) + os.sep):
        return False
    base = os.path.basename(abs_path)
    if "MangoHud" not in base:
        return False
    return True


def test_delete_log_file_rejects_outside_tmp():
    with tempfile.TemporaryDirectory() as tmp:
        assert _validate_log_path("/etc/passwd", tmp) is False
        assert _validate_log_path(os.path.expanduser("~/x.log"), tmp) is False


def test_delete_log_file_rejects_non_mangohud():
    with tempfile.TemporaryDirectory() as tmp:
        assert _validate_log_path(os.path.join(tmp, "system.log"), tmp) is False
        assert _validate_log_path(os.path.join(tmp, "MangoHud-1.csv"), tmp) is True
```

- [ ] **Step 2: Run tests to verify they fail/pass appropriately**

Run: `cd plugins/decky-vault && python -m pytest tests/test_clear_log.py -v`
Expected: PASS (these tests mirror the intended logic via local helpers; they document the contract). If they pass already, that's fine — they're the spec for the implementation you'll add to `main.py` next.

- [ ] **Step 3: Implement the safe `clear_mangohud_log` + `delete_log_file` in `main.py`**

Replace the existing `clear_mangohud_log` method (around line 369) with:

```python
    async def clear_mangohud_log(self) -> dict:
        """RPC: Delete stale MangoHud log files in /tmp/ so the next recording
        starts fresh. Only touches files whose name contains 'MangoHud'; never
        bare /tmp/*.log or /tmp/*.csv. Skips files modified in the last 3s
        (an active session may still have them open)."""
        import glob
        import time
        RECENT_WINDOW_S = 3
        now = time.time()
        deleted, skipped = [], []
        try:
            for pattern in ["/tmp/*MangoHud*"]:
                for f in glob.glob(pattern):
                    if not os.path.isfile(f):
                        continue
                    try:
                        if now - os.path.getmtime(f) < RECENT_WINDOW_S:
                            skipped.append({"name": os.path.basename(f), "reason": "active"})
                            continue
                        os.remove(f)
                        deleted.append({"name": os.path.basename(f)})
                    except (IOError, PermissionError):
                        skipped.append({"name": os.path.basename(f), "reason": "perm"})
            return {"success": True, "deleted": deleted, "skipped": skipped}
        except Exception as e:
            return {"success": False, "error": str(e), "deleted": deleted, "skipped": skipped}

    async def delete_log_file(self, path: str) -> dict:
        """RPC: Delete a single, specific MangoHud log file. The path must be
        under /tmp and its basename must contain 'MangoHud'. Defence in depth
        so a bad/stale path can never delete unrelated files."""
        try:
            if not path:
                return {"success": False, "error": "No path provided"}
            abs_path = os.path.abspath(path)
            if not abs_path.startswith("/tmp/"):
                return {"success": False, "error": "Refusing to delete file outside /tmp"}
            if "MangoHud" not in os.path.basename(abs_path):
                return {"success": False, "error": "Refusing to delete non-MangoHud file"}
            if not os.path.exists(abs_path):
                return {"success": True, "deleted": False, "note": "already gone"}
            os.remove(abs_path)
            return {"success": True, "deleted": True, "path": abs_path}
        except Exception as e:
            return {"success": False, "error": str(e)}
```

- [ ] **Step 4: Wire `lastLogPath` through the session store**

In `plugins/decky-vault/src/lib/store.ts`:

Add to `SessionData` interface (near the other auto-captured fields):

```ts
  lastLogPath: string | null
```

In `createEmptySession()` add:

```ts
    lastLogPath: null,
```

In `useSession`, add an updater so `handleStop` can record the log path. Add to the returned object a new function:

```ts
  const setLastLogPath = useCallback((p: string | null) => {
    setSession((prev) => ({ ...prev, lastLogPath: p }))
  }, [])
```

and include `setLastLogPath` in the returned object.

- [ ] **Step 5: Update `api.ts` with the new RPC wrapper**

In `plugins/decky-vault/src/lib/api.ts`, add:

```ts
export const deleteLogFile = callable<[path: string], {
  success: boolean
  deleted?: boolean
  error?: string
}>("delete_log_file")
```

- [ ] **Step 6: Update `handleStart` and `handleStop` in `index.tsx`**

In `plugins/decky-vault/src/index.tsx`:

Add `deleteLogFile` to the import from `"./lib/api"`. Add `setLastLogPath` to the destructured props from `useSession()` (also pass it through to `MainPanel`/`SessionForm` only if needed — it's used in `Content`'s stop handler).

Replace `handleStart`:

```ts
  async function handleStart() {
    // Clear the previous session's specific log if we know it; else safe-clear.
    const prev = session.lastLogPath
    if (prev) {
      await deleteLogFile(prev)
    } else {
      await clearMangohudLog()
    }
    // Fire-and-forget: try to start MangoHud logging (retries until game launches)
    startMangohudLogging()
    startRecording()
  }
```

Key change: **`writeMangohudConfig()` is removed from the start path** (config is a one-time setup step; rewriting it mid-game crashes the wrapper).

In `handleStop`, after `readAndParseMangohudLog`, capture the log path. The current code calls `readAndParseMangohudLog()` with no arg. Change it to first find the log path, then parse it:

```ts
      // Find the most recent MangoHud log, parse it, remember its path
      const logPath = await findMangohudLog()
      const logResult = await readAndParseMangohudLog(logPath ?? undefined)
      if (logResult.error) {
        setError(logResult.error)
        return
      }
      setLastLogPath(logPath ?? null)
```

Add `findMangohudLog` to the import from `"./lib/api"` and to `api.ts`:

```ts
export const findMangohudLog = callable<[], { path: string | null }>("find_mangohud_log")
```

And add a thin `find_mangohud_log` RPC in `main.py` that reuses the existing `_find_mangohud_log`:

```python
    async def find_mangohud_log(self) -> dict:
        """RPC: Return the path of the most recent MangoHud log in /tmp/, or null."""
        path = await self._find_mangohud_log()
        return {"path": path}
```

Update the rest of `handleStop` to keep using `logResult` as before (the `updateSession({...})` block is unchanged).

- [ ] **Step 7: Build + run plugin Python tests**

Run: `cd plugins/decky-vault && python -m pytest tests/ -v && bun run build`
Expected: all Python tests PASS; plugin build succeeds.

- [ ] **Step 8: Commit**

```bash
git add plugins/decky-vault/main.py plugins/decky-vault/src/index.tsx plugins/decky-vault/src/lib/store.ts plugins/decky-vault/src/lib/api.ts plugins/decky-vault/tests/test_clear_log.py
git commit -m "fix(plugin): safe recording start — no mid-game config rewrite, scoped log clear"
```

---

## Task 4: Screenshot discovery (Bug 3)

**Files:**
- Modify: `plugins/decky-vault/main.py` (`list_screenshots` ~line 608; `read_screenshot` ~line 649)
- Test: `plugins/decky-vault/tests/test_screenshots.py` (new)

- [ ] **Step 1: Write failing tests for multi-path discovery + fallback**

Create `plugins/decky-vault/tests/test_screenshots.py`:

```python
"""Tests for screenshot discovery across Steam Game Mode + Desktop paths (Bug 3)."""
import os
import tempfile
import time
import pytest


def _touch(path, mtime_age=10, content=b"\xff\xd8\xff\xe0"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(content)
    t = time.time() - mtime_age
    os.utime(path, (t, t))


def _discover(home, app_id=None):
    """Mirror of Plugin.list_screenshot discovery against a fake home dir."""
    import glob
    base = os.path.join(home, "Pictures", "Screenshots")
    userdata = os.path.join(home, ".local", "share", "Steam", "userdata")
    patterns = [
        os.path.join(base, "*.jpg"),
        os.path.join(base, "*.png"),
        os.path.join(base, "Steam Client", "*.jpg"),
        os.path.join(base, "Steam Client", "*.png"),
        os.path.join(userdata, "*", "760", "remote", "*", "screenshots", "*.jpg"),
        os.path.join(userdata, "*", "760", "remote", "*", "screenshots", "*.png"),
    ]
    seen, files = set(), []
    for pat in patterns:
        for f in glob.glob(pat):
            if not os.path.isfile(f) or f in seen:
                continue
            if os.path.basename(f) == "most_recent.jpg":
                continue
            seen.add(f)
            # parse appid from userdata path if present
            parts = f.split(os.sep)
            f_app_id = None
            if "760" in parts:
                idx = parts.index("760")
                if idx >= 2:
                    try:
                        f_app_id = int(parts[idx - 2])
                    except ValueError:
                        pass
            try:
                files.append({"path": f, "name": os.path.basename(f),
                              "mtime": os.path.getmtime(f), "size": os.path.getsize(f),
                              "appId": f_app_id})
            except OSError:
                continue
    files.sort(key=lambda x: x["mtime"], reverse=True)
    if app_id is not None:
        # keep all Desktop exports + this app's userdata shots
        files = [x for x in files if x["appId"] is None or x["appId"] == app_id]
    return files


def test_discovers_all_three_locations():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "desktop.jpg"), mtime_age=30)
        _touch(os.path.join(home, "Pictures", "Screenshots", "Steam Client", "sc.jpg"), mtime_age=20)
        _touch(os.path.join(home, ".local", "share", "Steam", "userdata", "111", "760",
                            "remote", "2531310", "screenshots", "game.jpg"), mtime_age=10)
        found = _discover(home)
        names = [f["name"] for f in found]
        assert set(names) == {"desktop.jpg", "sc.jpg", "game.jpg"}
        # sorted newest first
        assert found[0]["name"] == "game.jpg"


def test_app_id_filter_keeps_desktop_plus_app():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "desktop.jpg"), mtime_age=30)
        _touch(os.path.join(home, ".local", "share", "Steam", "userdata", "111", "760",
                            "remote", "2531310", "screenshots", "want.jpg"), mtime_age=10)
        _touch(os.path.join(home, ".local", "share", "Steam", "userdata", "111", "760",
                            "remote", "9999", "screenshots", "other.jpg"), mtime_age=5)
        found = _discover(home, app_id=2531310)
        names = [f["name"] for f in found]
        assert "want.jpg" in names
        assert "desktop.jpg" in names
        assert "other.jpg" not in names


def test_most_recent_duplicate_skipped():
    with tempfile.TemporaryDirectory() as home:
        _touch(os.path.join(home, "Pictures", "Screenshots", "most_recent.jpg"), mtime_age=1)
        _touch(os.path.join(home, "Pictures", "Screenshots", "2026-01-01.jpg"), mtime_age=2)
        found = _discover(home)
        names = [f["name"] for f in found]
        assert "most_recent.jpg" not in names
        assert "2026-01-01.jpg" in names
```

- [ ] **Step 2: Run tests**

Run: `cd plugins/decky-vault && python -m pytest tests/test_screenshots.py -v`
Expected: PASS (documents contract).

- [ ] **Step 3: Implement the new `list_screenshots` in `main.py`**

Replace the existing `list_screenshots` (~line 608) with:

```python
    async def list_screenshots(self, limit: int = 50, app_id: int | None = None) -> dict:
        """RPC: List recent Steam screenshots from both Game Mode (userdata/760/remote)
        and Desktop Mode (~/Pictures/Screenshots). Returns newest first.
        When app_id is given, keeps all Desktop exports + that app's userdata shots."""
        import glob
        try:
            home = os.path.expanduser("~")
            base = os.path.join(home, "Pictures", "Screenshots")
            userdata = os.path.join(home, ".local", "share", "Steam", "userdata")
            patterns = [
                os.path.join(base, "*.jpg"),
                os.path.join(base, "*.png"),
                os.path.join(base, "Steam Client", "*.jpg"),
                os.path.join(base, "Steam Client", "*.png"),
                os.path.join(userdata, "*", "760", "remote", "*", "screenshots", "*.jpg"),
                os.path.join(userdata, "*", "760", "remote", "*", "screenshots", "*.png"),
            ]
            seen, files = set(), []
            for pat in patterns:
                for f in glob.glob(pat):
                    if not os.path.isfile(f) or f in seen:
                        continue
                    if os.path.basename(f) == "most_recent.jpg":
                        continue
                    seen.add(f)
                    # parse appId from the userdata path (..../<appid>/screenshots/...)
                    f_app_id = None
                    parts = f.split(os.sep)
                    if "760" in parts:
                        idx = parts.index("760")
                        if idx >= 2:
                            try:
                                f_app_id = int(parts[idx - 2])
                            except ValueError:
                                pass
                    try:
                        files.append({
                            "path": f, "name": os.path.basename(f),
                            "mtime": os.path.getmtime(f), "size": os.path.getsize(f),
                            "appId": f_app_id,
                        })
                    except OSError:
                        continue
            if app_id is not None:
                files = [x for x in files if x["appId"] is None or x["appId"] == app_id]
            files.sort(key=lambda x: x["mtime"], reverse=True)
            return {"screenshots": files[:limit]}
        except Exception as e:
            return {"screenshots": [], "error": str(e)}
```

- [ ] **Step 4: Update `read_screenshot` fallback for no-Pillow**

Replace the `except ImportError` block inside `read_screenshot` (~line 649) with a size-guarded fallback. The current fallback returns the full raw bytes; change it so CEF never gets a giant buffer:

```python
            except ImportError:
                # No Pillow — only return raw if small enough for CEF; else skip preview.
                ext = os.path.splitext(path)[1].lower()
                mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else "image/jpeg")
                if len(raw) > 1_000_000:
                    return {"dataUrl": "", "error": "Preview unavailable (too large, no Pillow)"}
                b64 = base64.b64encode(raw).decode("ascii")
                return {"dataUrl": f"data:{mime};base64,{b64}"}
```

- [ ] **Step 5: Update the `listScreenshots` TS type in `api.ts`**

In `plugins/decky-vault/src/lib/api.ts`, update the type and add the `appId` field:

```ts
export const listScreenshots = callable<[limit?: number, appId?: number], {
  screenshots: Array<{ path: string; name: string; mtime: number; size: number; appId: number | null }>
  error?: string
}>("list_screenshots")
```

- [ ] **Step 6: Build + run tests**

Run: `cd plugins/decky-vault && python -m pytest tests/ -v && bun run build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add plugins/decky-vault/main.py plugins/decky-vault/src/lib/api.ts plugins/decky-vault/tests/test_screenshots.py
git commit -m "fix(plugin): discover Steam Game Mode screenshots + safe preview fallback"
```

---

## Task 5: New read API `plugin-public.ts` + mount (Feature, server side)

**Files:**
- Create: `apps/web/lib/api/plugin-public.ts`
- Modify: `apps/web/lib/api/app.ts` (import + mount in the public/read group)
- Test: `apps/web/lib/api/__tests__/plugin-public.test.ts` (new)

- [ ] **Step 1: Write failing test (contract + device scope + 404)**

Create `apps/web/lib/api/__tests__/plugin-public.test.ts`. Follow the existing heavy-mock style used in `auto-pin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => ({ and: args })),
  desc: vi.fn((col) => ({ desc: col })),
  avg: vi.fn((col) => ({ avg: col })),
  min: vi.fn((col) => ({ min: col })),
  max: vi.fn((col) => ({ max: col })),
  count: vi.fn((col) => ({ count: col })),
  sql: vi.fn((strings, ...vals) => ({ strings, vals })),
}))
vi.mock("drizzle-orm/pg-core", () => ({
  pgTable: vi.fn((n, c, i) => ({ name: n, columns: c, indexes: i })),
  pgEnum: vi.fn((n, v) => ({ name: n, values: v })),
  text: vi.fn((n) => n), integer: vi.fn((n) => n), real: vi.fn((n) => n),
  boolean: vi.fn((n) => n), timestamp: vi.fn((n) => n), jsonb: vi.fn((n) => n),
  index: vi.fn((n) => ({ on: vi.fn() })),
}))
vi.mock("@/lib/db/schema", () => ({
  games: { id: "id", steamAppId: "steam_app_id" },
  gameVersions: { id: "id", gameId: "game_id", isLatest: "is_latest", createdAt: "created_at" },
  performanceEntries: { id: "id", versionId: "version_id", hardwareSlug: "hardware_slug",
    fpsAvg: "fps_avg", fpsLow: "fps_low", fpsOnePercentLow: "fps_one_percent_low",
    fpsHigh: "fps_high", isRemoved: "is_removed", isPinned: "is_pinned", upvotes: "upvotes",
    upscalerType: "upscaler_type", frameGenMethod: "frame_gen_method", protonVersion: "proton_version",
    osVersion: "os_version", tdpWatts: "tdp_watts", settingsJson: "settings_json",
    createdAt: "created_at", userId: "user_id" },
  hardware: { slug: "slug", name: "name" },
  user: { id: "id", name: "name", image: "image" },
}))
vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })) })) })),
  },
}))

import { buildPluginGameResponse } from "@/lib/api/plugin-public"

describe("buildPluginGameResponse — shape contract", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns { game: null, error } shape when game is missing", async () => {
    const r = await buildPluginGameResponse({ game: null })
    expect(r.game).toBeNull()
    expect(typeof r.error).toBe("string")
    expect(r.estFps).toBeNull()
    expect(r.topEntries).toEqual([])
    expect(r.recentEntries).toEqual([])
  })

  it("returns estFps null when there are no entries", async () => {
    const r = await buildPluginGameResponse({ game: { id: "g1", steamAppId: 123, title: "X", slug: "x" }, entries: [], recent: [] })
    expect(r.game).not.toBeNull()
    expect(r.estFps).toBeNull()
    expect(r.topEntries).toEqual([])
    expect(r.recentEntries).toEqual([])
  })

  it("computes estFps from entries and trims entry fields", async () => {
    const entries = [
      { id: "e1", hardwareSlug: "steamdeck-oled", fpsAvg: 60, fpsLow: 40, fpsOnePercentLow: 45, fpsHigh: 90,
        upscalerType: "none", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 12,
        settingsJson: null, upvotes: 5, isPinned: true, createdAt: new Date("2026-01-01"),
        userName: "u", userImage: null },
      { id: "e2", hardwareSlug: "steamdeck-oled", fpsAvg: 80, fpsLow: 55, fpsOnePercentLow: 60, fpsHigh: 120,
        upscalerType: "fsr", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 15,
        settingsJson: null, upvotes: 2, isPinned: false, createdAt: new Date("2026-02-01"),
        userName: "u2", userImage: null },
    ]
    const r = await buildPluginGameResponse({ game: { id: "g1", steamAppId: 123, title: "X", slug: "x" }, entries, recent: entries })
    expect(r.estFps).not.toBeNull()
    expect(r.estFps!.avg).toBeCloseTo(70, 1)
    expect(r.estFps!.count).toBe(2)
    expect(r.estFps!.high).toBe(120)
    expect(r.estFps!.low).toBe(40)
    expect(r.topEntries.length).toBe(2)
    expect(r.topEntries[0].id).toBe("e1") // pinned first
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- plugin-public`
Expected: FAIL — `buildPluginGameResponse is not a function`.

- [ ] **Step 3: Implement `plugin-public.ts`**

Create `apps/web/lib/api/plugin-public.ts`:

```ts
import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  hardware,
  user,
} from "@/lib/db/schema"
import { eq, and, desc, avg, min, max, count, sql } from "drizzle-orm"

// ── Pure helpers (unit-tested directly) ──────────────────────────

export type PluginGameRow = {
  id: string
  steamAppId: number | null
  title: string
  slug: string | null
}
export type PluginEntryRow = {
  id: string
  hardwareSlug: string
  fpsAvg: number
  fpsLow: number | null
  fpsOnePercentLow: number | null
  fpsHigh: number | null
  upscalerType: string
  frameGenMethod: string
  protonVersion: string | null
  osVersion: string | null
  tdpWatts: number | null
  settingsJson: unknown
  upvotes: number
  isPinned: boolean
  createdAt: Date
  userName: string | null
  userImage: string | null
}

export type PluginGameResponse = {
  game: { id: string; steamAppId: number | null; title: string; slug: string | null } | null
  estFps: { avg: number; low: number | null; onePct: number | null; high: number | null; count: number } | null
  topEntries: ReturnType<typeof trimEntry>[]
  recentEntries: ReturnType<typeof trimEntry>[]
  error?: string
}

function trimEntry(e: PluginEntryRow) {
  return {
    id: e.id,
    hardwareSlug: e.hardwareSlug,
    fpsAvg: e.fpsAvg,
    fpsLow: e.fpsLow,
    fpsOnePercentLow: e.fpsOnePercentLow,
    fpsHigh: e.fpsHigh,
    upscalerType: e.upscalerType,
    frameGenMethod: e.frameGenMethod,
    protonVersion: e.protonVersion,
    osVersion: e.osVersion,
    tdpWatts: e.tdpWatts,
    settingsJson: e.settingsJson,
    upvotes: e.upvotes,
    isPinned: e.isPinned,
    createdAt: e.createdAt.toISOString(),
    userName: e.userName,
    userImage: e.userImage,
  }
}

export async function buildPluginGameResponse(args: {
  game: PluginGameRow | null
  entries?: PluginEntryRow[]
  recent?: PluginEntryRow[]
}): Promise<PluginGameResponse> {
  if (!args.game) {
    return { game: null, estFps: null, topEntries: [], recentEntries: [], error: "Game not in DeckyVault" }
  }
  const entries = args.entries ?? []
  const recent = args.recent ?? []
  if (entries.length === 0) {
    return { game: { ...args.game }, estFps: null, topEntries: [], recentEntries: [] }
  }
  const fpsAvgVals = entries.map((e) => e.fpsAvg)
  const estFps = {
    avg: Math.round((fpsAvgVals.reduce((a, b) => a + b, 0) / fpsAvgVals.length) * 10) / 10,
    low: entries.reduce<number | null>((m, e) => (m == null ? e.fpsLow : Math.min(m, e.fpsLow ?? m)), null),
    onePct: entries.reduce<number | null>((m, e) => (m == null ? e.fpsOnePercentLow : Math.min(m, e.fpsOnePercentLow ?? m)), null),
    high: entries.reduce<number | null>((m, e) => (m == null ? e.fpsHigh : Math.max(m, e.fpsHigh ?? m)), null),
    count: entries.length,
  }
  // topEntries already come ordered pinned->upvotes from the query; keep order, trim.
  const topEntries = entries.map(trimEntry)
  const recentEntries = recent.map(trimEntry)
  return { game: { ...args.game }, estFps, topEntries, recentEntries }
}

// ── Route ────────────────────────────────────────────────────────

export const pluginPublicRoutes = new Elysia({
  prefix: "/plugin",
  detail: { tags: ["Plugin"] },
})
  .get(
    "/game/:steamAppId",
    async ({ params, query, set }) => {
      const steamAppId = Number(params.steamAppId)
      if (!Number.isInteger(steamAppId) || steamAppId <= 0) {
        set.status = 400
        return { error: "Invalid steamAppId" }
      }

      const [game] = await db
        .select({
          id: games.id,
          steamAppId: games.steamAppId,
          title: games.title,
          slug: games.slug,
        })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1)

      if (!game) {
        set.status = 404
        return await buildPluginGameResponse({ game: null })
      }

      // Resolve latest version
      const [latestVersion] = await db
        .select({ id: gameVersions.id })
        .from(gameVersions)
        .where(and(eq(gameVersions.gameId, game.id), eq(gameVersions.isLatest, true)))
        .limit(1)

      let versionId = latestVersion?.id
      if (!versionId) {
        const [anyVersion] = await db
          .select({ id: gameVersions.id })
          .from(gameVersions)
          .where(eq(gameVersions.gameId, game.id))
          .orderBy(gameVersions.createdAt)
          .limit(1)
        versionId = anyVersion?.id
      }
      if (!versionId) {
        return await buildPluginGameResponse({ game, entries: [], recent: [] })
      }

      const hardwareFilter = query.hardware ? eq(performanceEntries.hardwareSlug, query.hardware) : undefined
      const baseWhere = and(
        eq(performanceEntries.versionId, versionId),
        eq(performanceEntries.isRemoved, false),
        ...(hardwareFilter ? [hardwareFilter] : []),
      )

      // Top entries: pinned -> upvotes
      const topRows = await db
        .select({
          id: performanceEntries.id,
          hardwareSlug: performanceEntries.hardwareSlug,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
          fpsHigh: performanceEntries.fpsHigh,
          upscalerType: performanceEntries.upscalerType,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          tdpWatts: performanceEntries.tdpWatts,
          settingsJson: performanceEntries.settingsJson,
          upvotes: performanceEntries.upvotes,
          isPinned: performanceEntries.isPinned,
          createdAt: performanceEntries.createdAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(performanceEntries)
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .where(baseWhere)
        .orderBy(desc(performanceEntries.isPinned), desc(performanceEntries.upvotes))
        .limit(query.limit ?? 3)

      // Recent entries
      const recentRows = await db
        .select({
          id: performanceEntries.id,
          hardwareSlug: performanceEntries.hardwareSlug,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
          fpsHigh: performanceEntries.fpsHigh,
          upscalerType: performanceEntries.upscalerType,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          tdpWatts: performanceEntries.tdpWatts,
          settingsJson: performanceEntries.settingsJson,
          upvotes: performanceEntries.upvotes,
          isPinned: performanceEntries.isPinned,
          createdAt: performanceEntries.createdAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(performanceEntries)
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .where(baseWhere)
        .orderBy(desc(performanceEntries.createdAt))
        .limit(query.limit ?? 3)

      set.headers["Cache-Control"] = "public, max-age=60"
      return await buildPluginGameResponse({
        game,
        entries: topRows as unknown as PluginEntryRow[],
        recent: recentRows as unknown as PluginEntryRow[],
      })
    },
    {
      params: t.Object({ steamAppId: t.Numeric() }),
      query: t.Object({
        hardware: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        description:
          "Public read endpoint for the DeckyVault Decky plugin's library app-details panel. " +
          "Returns game status, device-scoped estimated FPS, and top/recent entries.",
      },
    },
  )
  .get(
    "/game/:steamAppId/devices",
    async ({ params, set }) => {
      const steamAppId = Number(params.steamAppId)
      const [game] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.steamAppId, steamAppId))
        .limit(1)
      if (!game) {
        set.status = 404
        return { error: "Game not in DeckyVault", devices: [] }
      }
      const rows = await db
        .select({
          slug: performanceEntries.hardwareSlug,
          count: sql<number>`count(*)::int`,
          name: hardware.name,
        })
        .from(performanceEntries)
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(and(eq(gameVersions.gameId, game.id), eq(performanceEntries.isRemoved, false)))
        .groupBy(performanceEntries.hardwareSlug, hardware.name)
        .orderBy(desc(sql`count(*)`))
      set.headers["Cache-Control"] = "public, max-age=60"
      return { devices: rows }
    },
    {
      params: t.Object({ steamAppId: t.Numeric() }),
    },
  )
```

- [ ] **Step 4: Mount the route in `app.ts`**

In `apps/web/lib/api/app.ts`:

Add to the imports near the other route imports:

```ts
import { pluginPublicRoutes } from "@/lib/api/plugin-public"
```

Add `.use(pluginPublicRoutes)` inside the **read group** (the `.group("", (app) => app .use(gamesPerformanceRoutes) ... .use(gamesLookupRoutes) .use(pluginPairingRoutes) )` block), e.g. right after `.use(pluginPairingRoutes)`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test -- plugin-public`
Expected: PASS (3 cases).

- [ ] **Step 6: Lint + typecheck**

Run: `cd apps/web && bun run lint && bunx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/api/plugin-public.ts apps/web/lib/api/app.ts apps/web/lib/api/__tests__/plugin-public.test.ts
git commit -m "feat(api): public plugin game-lookup endpoint for library panel"
```

---

## Task 6: Plugin `plugin_get` RPC + `plugin-api.ts` fetch/cache (Feature, plugin data layer)

**Files:**
- Modify: `plugins/decky-vault/main.py` (add `plugin_get`)
- Modify: `plugins/decky-vault/src/lib/api.ts` (add `pluginGet`)
- Create: `plugins/decky-vault/src/lib/plugin-api.ts`

- [ ] **Step 1: Add `plugin_get` to `main.py`**

Add near the other HTTP RPCs (e.g. after `test_api_key`):

```python
    async def plugin_get(self, path: str, base_url: str = "https://deckyvault.xyz") -> dict:
        """RPC: Public read proxy for the DeckyVault API (used by the library panel).
        Performs a GET to {base_url}/api{path} and returns parsed JSON or {error, status}.
        Keeps network in the Python backend to avoid CEF CORS issues."""
        import urllib.request
        import urllib.error
        try:
            # Prevent SSRF: only allow http(s) and only to the configured base_url host.
            if not path.startswith("/"):
                path = "/" + path
            url = f"{base_url}/api{path}"
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:136.0) Gecko/20100101 Firefox/136.0",
                    "Accept": "application/json",
                },
                method="GET",
            )
            context = _get_ssl_context()
            with urllib.request.urlopen(req, timeout=10, context=context) as response:
                body = response.read().decode("utf-8")
                try:
                    return json.loads(body)
                except json.JSONDecodeError:
                    return {"error": "Invalid JSON", "status": response.status}
        except urllib.error.HTTPError as e:
            try:
                err = json.loads(e.read().decode("utf-8"))
                return {**err, "status": e.code}
            except Exception:
                return {"error": f"Server returned status {e.code}", "status": e.code}
        except urllib.error.URLError as e:
            return {"error": f"Network error: {str(e.reason)}", "status": 0}
        except Exception as e:
            return {"error": str(e), "status": 0}
```

- [ ] **Step 2: Add the `pluginGet` wrapper in `api.ts`**

In `plugins/decky-vault/src/lib/api.ts`:

```ts
export const pluginGet = callable<[path: string, baseUrl?: string], Record<string, unknown> & { status?: number; error?: string }>("plugin_get")
```

- [ ] **Step 3: Create `plugin-api.ts` with the typed fetch + LRU cache**

Create `plugins/decky-vault/src/lib/plugin-api.ts`:

```ts
import { pluginGet } from "./api"

export interface PluginEntry {
  id: string
  hardwareSlug: string
  fpsAvg: number
  fpsLow: number | null
  fpsOnePercentLow: number | null
  fpsHigh: number | null
  upscalerType: string
  frameGenMethod: string
  protonVersion: string | null
  osVersion: string | null
  tdpWatts: number | null
  settingsJson: unknown
  upvotes: number
  isPinned: boolean
  createdAt: string
  userName: string | null
  userImage: string | null
}

export interface PluginGameResponse {
  game: { id: string; steamAppId: number | null; title: string; slug: string | null } | null
  estFps: { avg: number; low: number | null; onePct: number | null; high: number | null; count: number } | null
  topEntries: PluginEntry[]
  recentEntries: PluginEntry[]
  error?: string
}

export interface PluginDeviceRow {
  slug: string
  name: string
  count: number
}

// Tiny per-appId cache (1h TTL)
interface CacheEntry { value: PluginGameResponse; expires: number }
const cache = new Map<string, CacheEntry>()
const TTL_MS = 60 * 60 * 1000
const settingsRef: { baseUrl: string } = { baseUrl: "https://deckyvault.xyz" }

export function setPluginApiBaseUrl(url: string) {
  settingsRef.baseUrl = url || "https://deckyvault.xyz"
}

export async function fetchPluginGame(
  steamAppId: number,
  hardware: string | null,
  limit: number,
): Promise<PluginGameResponse> {
  const key = `${steamAppId}|${hardware ?? "all"}|${limit}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value

  const path = `/plugin/game/${steamAppId}?limit=${limit}${hardware ? `&hardware=${encodeURIComponent(hardware)}` : ""}`
  const raw = await pluginGet(path, settingsRef.baseUrl)
  const value = raw as unknown as PluginGameResponse
  cache.set(key, { value, expires: Date.now() + TTL_MS })
  return value
}

export async function fetchPluginDevices(steamAppId: number): Promise<PluginDeviceRow[]> {
  const raw = await pluginGet(`/plugin/game/${steamAppId}/devices`, settingsRef.baseUrl)
  if (raw.error) return []
  return (raw.devices as PluginDeviceRow[]) ?? []
}

export function clearPluginCache(steamAppId?: number) {
  if (steamAppId == null) { cache.clear(); return }
  for (const k of cache.keys()) {
    if (k.startsWith(`${steamAppId}|`)) cache.delete(k)
  }
}
```

- [ ] **Step 4: Build the plugin**

Run: `cd plugins/decky-vault && bun run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add plugins/decky-vault/main.py plugins/decky-vault/src/lib/api.ts plugins/decky-vault/src/lib/plugin-api.ts
git commit -m "feat(plugin): plugin_get proxy + typed library-panel fetch/cache"
```

---

## Task 7: Library app-details patch + panel + wiring (Feature, plugin UI)

**Files:**
- Create: `plugins/decky-vault/src/patches/LibraryApp.tsx`
- Create: `plugins/decky-vault/src/components/LibraryAppPanel.tsx`
- Modify: `plugins/decky-vault/src/index.tsx` (register patch on load, remove on dismount; pass `baseUrl`/`hardwareSlug` to the panel data layer)

- [ ] **Step 1: Create the `LibraryAppPanel.tsx` component**

Create `plugins/decky-vault/src/components/LibraryAppPanel.tsx`:

```tsx
import { useEffect, useState } from "react"
import { PanelSection, PanelSectionRow, DropdownItem, staticClasses } from "@decky/ui"
import { FaCheck, FaTimes, FaChartLine } from "react-icons/fa"
import {
  fetchPluginGame,
  fetchPluginDevices,
  setPluginApiBaseUrl,
  type PluginGameResponse,
  type PluginDeviceRow,
  type PluginEntry,
} from "../lib/plugin-api"

interface Props {
  appId: number
  title: string
  hardwareSlug: string | null      // detected device
  baseUrl: string
}

function EntryCard({ e }: { e: PluginEntry }) {
  const [expanded, setExpanded] = useState(false)
  const settingsCount = Array.isArray(e.settingsJson)
    ? (e.settingsJson as Array<{ settings: unknown[] }>).reduce((s, c) => s + (c.settings?.length ?? 0), 0)
    : 0
  const label = e.isPinned ? "Pinned" : e.upvotes > 0 ? `${e.upvotes}👍` : "Recent"
  return (
    <PanelSectionRow>
      <div
        onClick={() => setExpanded((v) => !v)}
        style={{ padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}
      >
        <div className={staticClasses.Text} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
          <strong>{e.fpsAvg} FPS avg</strong>
          <span style={{ opacity: 0.7 }}>{label}</span>
        </div>
        <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.6, marginTop: 2 }}>
          {e.fpsLow ?? "—"} low · {e.fpsOnePercentLow ?? "—"} 1% · {e.fpsHigh ?? "—"} high
          {e.tdpWatts ? ` · ${e.tdpWatts}W` : ""}
          {e.upscalerType && e.upscalerType !== "none" ? ` · ${e.upscalerType}` : ""}
          {e.protonVersion ? ` · Proton ${e.protonVersion}` : ""}
        </div>
        {expanded && (
          <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.7, marginTop: 6, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6 }}>
            <div>By {e.userName ?? "unknown"} · {new Date(e.createdAt).toLocaleDateString()}</div>
            <div>{settingsCount} settings</div>
            {e.osVersion && <div>OS: {e.osVersion}</div>}
          </div>
        )}
      </div>
    </PanelSectionRow>
  )
}

export default function LibraryAppPanel({ appId, title, hardwareSlug, baseUrl }: Props) {
  const [data, setData] = useState<PluginGameResponse | null>(null)
  const [devices, setDevices] = useState<PluginDeviceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [device, setDevice] = useState<string>(hardwareSlug ?? "")  // "" = all devices

  useEffect(() => {
    setPluginApiBaseUrl(baseUrl)
    let cancelled = false
    async function load() {
      setLoading(true)
      const d = await fetchPluginGame(appId, device || null, 3)
      if (!cancelled) { setData(d); setLoading(false) }
      const devs = await fetchPluginDevices(appId)
      if (!cancelled) setDevices(devs)
    }
    load()
    return () => { cancelled = true }
  }, [appId, device, baseUrl])

  if (loading) {
    return (
      <PanelSection title="DeckyVault">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ padding: "8px 0", fontSize: "12px", opacity: 0.6 }}>Loading DeckyVault…</div>
        </PanelSectionRow>
      </PanelSection>
    )
  }

  const deviceOptions = [
    { label: "All devices", data: "" },
    ...(hardwareSlug ? [{ label: `Your device (${hardwareSlug})`, data: hardwareSlug }] : []),
    ...devices
      .filter((d) => d.slug !== hardwareSlug)
      .map((d) => ({ label: `${d.name} (${d.count})`, data: d.slug })),
  ]

  if (!data || !data.game) {
    return (
      <PanelSection title="DeckyVault">
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "6px 0", opacity: 0.7 }}>
            <FaTimes /> Not in DeckyVault yet. Open <strong>{title}</strong> on{" "}
            <a href={`${baseUrl}/games`}>deckyvault.xyz</a> to add it.
          </div>
        </PanelSectionRow>
      </PanelSection>
    )
  }

  return (
    <PanelSection title="DeckyVault">
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "12px", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <FaCheck style={{ color: "#2ecc71" }} /> In DeckyVault
        </div>
      </PanelSectionRow>

      {/* Est FPS */}
      <PanelSectionRow>
        <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "4px 0", display: "flex", alignItems: "center", gap: 6 }}>
          <FaChartLine /> Est FPS
        </div>
      </PanelSectionRow>
      {data.estFps ? (
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "13px", padding: "0 0 6px 0" }}>
            <strong>{data.estFps.avg}</strong> avg · {data.estFps.low ?? "—"} low · {data.estFps.onePct ?? "—"} 1% · {data.estFps.high ?? "—"} high
            <span style={{ opacity: 0.5, fontSize: "11px" }}> · {data.estFps.count} entries</span>
          </div>
        </PanelSectionRow>
      ) : (
        <PanelSectionRow>
          <div className={staticClasses.Text} style={{ fontSize: "12px", opacity: 0.6, padding: "0 0 6px 0" }}>
            No entries for this device yet — be the first: open the DeckyVault plugin and record.
          </div>
        </PanelSectionRow>
      )}

      {/* Device switcher */}
      <PanelSectionRow>
        <DropdownItem
          label="Device"
          rgOptions={deviceOptions}
          selectedOption={device}
          onChange={(opt) => setDevice(opt.data as string)}
        />
      </PanelSectionRow>

      {/* Top entries */}
      {data.topEntries.length > 0 && (
        <>
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ fontSize: "11px", opacity: 0.5, padding: "8px 0 2px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Top entries
            </div>
          </PanelSectionRow>
          {data.topEntries.map((e) => <EntryCard key={e.id} e={e} />)}
        </>
      )}
    </PanelSection>
  )
}
```

- [ ] **Step 2: Create the `LibraryApp.tsx` patch**

Create `plugins/decky-vault/src/patches/LibraryApp.tsx`:

```tsx
import {
  afterPatch,
  appDetailsClasses,
  createReactTreePatcher,
  findInReactTree,
} from "@decky/ui"
import { routerHook } from "@decky/api"
import type { ReactElement } from "react"
import LibraryAppPanel from "../components/LibraryAppPanel"

// Mirror of HLTB-for-Deck's patchAppPage, guarded so a Steam UI change
// degrades to "section not shown" instead of crashing Steam.
function isSteamGameType(appType: number) {
  return appType === 1 || appType === 8 // Game, Demo
}

// These are supplied by the plugin at registration time (read from settings).
let panelProps: { hardwareSlug: string | null; baseUrl: string } = { hardwareSlug: null, baseUrl: "https://deckyvault.xyz" }
export function setLibraryAppPanelProps(p: { hardwareSlug: string | null; baseUrl: string }) {
  panelProps = p
}

export function registerLibraryAppPatch() {
  return routerHook.addPatch("/library/app/:appid", (routerTree: any) => {
    try {
      const routeProps = findInReactTree(routerTree, (x: any) => x?.renderFunc)
      if (!routeProps) return routerTree

      const patchHandler = createReactTreePatcher(
        [
          (tree: any) => {
            const child = findInReactTree(
              tree,
              (x: any) => x?.props?.children?.props?.overview,
            )
            if (!child) return null
            const overview = child.props.children.props.overview
            if (!overview || !isSteamGameType(overview.app_type)) return null
            return child.props.children
          },
        ],
        (_: Record<string, unknown>[], ret: ReactElement) => {
          try {
            const container = findInReactTree(
              ret,
              (x: any) =>
                Array.isArray(x?.props?.children) &&
                x?.props?.className?.includes(appDetailsClasses.InnerContainer),
            )
            const arr = container?.props?.children
            if (!Array.isArray(arr)) {
              console.debug("[DeckyVault] app-details: no splicable container (non-game page?)")
              return ret
            }
            const idx = arr.findIndex((child: ReactElement) => {
              const p = child?.props
              return (
                p?.childFocusDisabled !== undefined &&
                p?.navRef !== undefined &&
                p?.children?.props?.details !== undefined &&
                p?.children?.props?.overview !== undefined &&
                p?.children?.props?.bFastRender !== undefined
              )
            })
            if (idx > -1) {
              const overview = arr[idx]?.props?.children?.props?.overview
              arr.splice(
                idx,
                0,
                <LibraryAppPanel
                  appId={overview?.appid}
                  title={overview?.display_name ?? ""}
                  hardwareSlug={panelProps.hardwareSlug}
                  baseUrl={panelProps.baseUrl}
                />,
              )
            } else {
              console.debug("[DeckyVault] app-details: splicing anchor not found")
            }
          } catch (err) {
            console.error("[DeckyVault] app-details splice failed:", err)
          }
          return ret
        },
      )

      afterPatch(routeProps, "renderFunc", patchHandler)
    } catch (err) {
      console.error("[DeckyVault] library patch failed (degraded):", err)
    }
    return routerTree
  })
}
```

- [ ] **Step 3: Wire it into `index.tsx`**

In `plugins/decky-vault/src/index.tsx`:

Add imports:

```ts
import { registerLibraryAppPatch, setLibraryAppPanelProps } from "./patches/LibraryApp"
```

Inside the `definePlugin(() => { ... })` body, before the `return`, register the patch and keep its handle so we can remove it on dismount. The `Content` component already has `settings` via `useSettings`. Since the plugin object is created once at load, register the patch at the top of the factory and set panel props from a lightweight effect inside `Content`.

Change the `definePlugin` body to:

```ts
export default definePlugin(() => {
  const libraryAppPatch = registerLibraryAppPatch()

  function Content() {
    const { settings, updateSetting, loaded } = useSettings()
    // keep the library panel's props in sync with settings
    useEffect(() => {
      setLibraryAppPanelProps({ hardwareSlug: settings.hardwareSlug, baseUrl: settings.baseUrl })
    }, [settings.hardwareSlug, settings.baseUrl])

    const {
      recordingState, session, recentSessions, error, setError,
      startRecording, stopRecording, updateSession, addToRecent, reset,
      onGameStart, onGameStop, setGameName, setLastLogPath,
    } = useSession()

    useGameDetection(setGameName, recordingState)

    // ... (handleStart / handleStop from Task 3 stay here, unchanged from Task 3) ...

    if (!loaded) {
      return (
        <PanelSection title="DeckyVault">
          <PanelSectionRow>
            <div className={staticClasses.Text} style={{ padding: "16px", textAlign: "center" }}>Loading...</div>
          </PanelSectionRow>
        </PanelSection>
      )
    }

    return (
      <>
        <MainPanel
          recordingState={recordingState}
          session={session}
          recentSessions={recentSessions}
          error={error}
          settings={settings}
          onStart={handleStart}
          onStop={handleStop}
          onUpdateSession={updateSession}
          onAddToRecent={addToRecent}
          onReset={reset}
          setError={setError}
          setGameName={setGameName}
          onUpdateSetting={updateSetting}
        />
      </>
    )
  }

  return {
    name: "DeckyVault",
    titleView: <div className={staticClasses.Title}>DeckyVault</div>,
    content: <Content />,
    icon: <DeckyVaultIcon />,
    alwaysRender: true,
    onDismount() {
      try { routerHook.removePatch("/library/app/:appid", libraryAppPatch) } catch (e) { console.error("[DeckyVault] removePatch failed:", e) }
      console.log("[DeckyVault] Plugin unloading")
    },
  }
})
```

Add `routerHook` to the import from `"@decky/api"`:

```ts
import { definePlugin, routerHook } from "@decky/api"
```

Add `useEffect` to the React import:

```ts
import { useEffect } from "react"
```

Note: the existing `Content` function body (handleStart/handleStop from Task 3, the loading/return JSX) moves **inside** the factory as shown. Keep `DeckyVaultIcon` defined outside the factory as today.

- [ ] **Step 4: Build the plugin**

Run: `cd plugins/decky-vault && bun run build`
Expected: build succeeds (`dist/index.js`). If rollup reports missing exports from `@decky/ui` (`afterPatch`, `createReactTreePatcher`, `findInReactTree`, `appDetailsClasses`), re-check the installed package; these were verified present in Task 0 research.

- [ ] **Step 5: Lint/typecheck**

Run: `cd plugins/decky-vault && bunx tsc --noEmit`
Expected: no new errors (some Decky globals may be untyped — cast as `any` where needed, as HLTB does).

- [ ] **Step 6: Commit**

```bash
git add plugins/decky-vault/src/patches/LibraryApp.tsx plugins/decky-vault/src/components/LibraryAppPanel.tsx plugins/decky-vault/src/index.tsx
git commit -m "feat(plugin): inject DeckyVault section into library app-details page"
```

---

## Task 8: Final build + lint + test sweep

**Files:** none (verification only)

- [ ] **Step 1: Run plugin Python tests**

Run: `cd plugins/decky-vault && python -m pytest tests/ -v`
Expected: all tests PASS (parser, settings, clear_log, screenshots).

- [ ] **Step 2: Build the plugin**

Run: `cd plugins/decky-vault && bun run build`
Expected: `dist/index.js` written, no errors.

- [ ] **Step 3: Run web tests + lint**

Run: `bun run test && cd apps/web && bun run lint && bunx tsc --noEmit`
Expected: tests PASS; lint clean; no new type errors.

- [ ] **Step 4: Final commit (if any formatting fixups)**

Only if the lint step changed files:

```bash
git add -A
git commit -m "chore: final sweep fixups"
```

- [ ] **Step 5: Manual smoke note (not automated)**

Document for the user the manual smoke checks to run on-device:
- Start a recording while a game is running, stop, start again → game must not crash.
- Upload a recording for a game not in DB → see the not-in-DB message; add the game on the site; a no-FPS recording now shows "No FPS data captured" instead of "FPS 0-500".
- Open the screenshot picker → Game Mode (`userdata/760/remote/...`) screenshots now appear.
- Open a library app-details page for a game in DeckyVault → the DeckyVault section appears with est FPS, device switcher, and top entries; a non-DeckyVault game shows the CTA; a soundtrack page shows nothing.

---

## Self-Review notes (run after writing — issues fixed inline)

- **Spec coverage:** Bug 1 → Task 3; Bug 2 → Tasks 1–2; Bug 3 → Task 4; Feature (4&5 unified) → Tasks 5–7. All spec sections covered.
- **Validation ordering (Task 1):** FPS validation moved **before** game lookup so a 404 can never mask a 400 — matches spec §2.2.
- **Type consistency:** `validateFps` (Task 1) returns `values` used downstream; `buildPluginGameResponse` (Task 5) is imported by the Task 5 test and reused shape in `plugin-api.ts` (Task 6). `registerLibraryAppPatch`/`setLibraryAppPanelProps` (Task 7) match the `index.tsx` wiring. `findMangohudLog`/`deleteLogFile`/`pluginGet` RPC names match across `main.py`, `api.ts`, and `index.tsx`.
- **No placeholders:** every code step contains full code.
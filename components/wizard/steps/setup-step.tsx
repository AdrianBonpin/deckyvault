"use client"

import { GitBranch, DatabaseIcon, RefreshCwIcon } from "lucide-react"
import { HardwareStep } from "./hardware-step"
import { AntiCheatStep, type AntiCheatData } from "./anti-cheat-step"

export interface GameVersionInfo {
  id: string
  versionString: string | null
  buildId: string | null
  isLatest: boolean
}

export interface SteamDBVersion {
  versionString: string | null
  buildId: string | null
}

interface SetupStepProps {
  gameId: string
  gameVersions: GameVersionInfo[]
  hardwareSlug: string
  onHardwareChange: (slug: string) => void
  hardwareName: string
  selectedVersionId: string
  onVersionChange: (versionId: string) => void
  newVersionString: string
  onNewVersionStringChange: (value: string) => void
  isCreatingVersion: boolean
  antiCheat: AntiCheatData
  onAntiCheatChange: (data: AntiCheatData) => void
  platformSupport: {
    hardwareSlug: string
    antiCheatRelevant: boolean
    antiCheatName: string | null
    antiCheatStatus: "none" | "supported" | "unsupported" | "unknown"
  }[]
  steamdbVersion: SteamDBVersion | null
  steamdbLoading: boolean
  onRefreshSteamDB: () => void
}

export function SetupStep({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  gameId: _gameId,
  gameVersions,
  hardwareSlug,
  onHardwareChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hardwareName: _hardwareName,
  selectedVersionId,
  onVersionChange,
  newVersionString,
  onNewVersionStringChange,
  isCreatingVersion,
  antiCheat,
  onAntiCheatChange,
  platformSupport,
  steamdbVersion,
  steamdbLoading,
  onRefreshSteamDB,
}: SetupStepProps) {
  const isNewVersion = selectedVersionId === "__new__"
  const isSteamDBVersion = selectedVersionId === "__steamdb__"

  return (
    <div className="space-y-8">
      {/* Hardware Section */}
      <section>
        <HardwareStep value={hardwareSlug} onChange={onHardwareChange} />
      </section>

      <div className="border-t border-border" />

      {/* Game Version Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="h-4 w-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-text">Game Version</h3>
            <p className="text-xs text-text/60">
              Which version of the game did you test? This helps others know if benchmarks match their version.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Version</label>
            <select
              value={selectedVersionId}
              onChange={(e) => onVersionChange(e.target.value)}
              className="w-full appearance-none px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors cursor-pointer"
            >
              {/* SteamDB suggestion — appears at top when available */}
              {steamdbVersion && (steamdbVersion.versionString || steamdbVersion.buildId) && (
                <option value="__steamdb__" className="bg-primary/10 text-primary">
                  ⬇ Latest from SteamDB: {steamdbVersion.versionString || `Build ${steamdbVersion.buildId}`} — recommended
                </option>
              )}
              {steamdbLoading && (
                <option disabled className="text-text/40">
                  Fetching latest version from SteamDB...
                </option>
              )}
              <option disabled className="text-text/30 text-xs">
                ── Existing versions ──
              </option>
              {gameVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.versionString
                    ? v.versionString
                    : v.buildId
                    ? `Build ${v.buildId}`
                    : "Unknown version"}
                  {v.isLatest ? " (latest)" : ""}
                </option>
              ))}
              <option value="__new__">
                ＋ New version...
              </option>
            </select>

            {/* Refresh button for SteamDB */}
            <button
              type="button"
              onClick={onRefreshSteamDB}
              disabled={steamdbLoading}
              className="flex items-center gap-1 text-xs text-text/40 hover:text-primary transition-colors cursor-pointer mt-1 disabled:opacity-30"
            >
              <RefreshCwIcon className={`h-3 w-3 ${steamdbLoading ? "animate-spin" : ""}`} />
              Refresh from SteamDB
            </button>
          </div>

          {isNewVersion && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text/60">
                Version String <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newVersionString}
                onChange={(e) => onNewVersionStringChange(e.target.value)}
                placeholder="e.g. 1.2.3, Patch 4.0, Hotfix Jan 2025"
                className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                disabled={isCreatingVersion}
              />
              <p className="text-xs text-text/40">
                Enter the game version you tested. This will create a new version entry.
              </p>
            </div>
          )}

          {isSteamDBVersion && steamdbVersion && (
            <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium text-primary">SteamDB Suggestion</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-text/40">Version</p>
                  <p className="text-sm text-text">{steamdbVersion.versionString || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-text/40">Build ID</p>
                  <p className="text-sm text-text font-mono">{steamdbVersion.buildId || "—"}</p>
                </div>
              </div>
              <p className="text-xs text-text/40">
                This version will be created when you submit your benchmark.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-border" />

      {/* Anti-Cheat Section */}
      <section>
        <AntiCheatStep
          hardwareSlug={hardwareSlug}
          platformSupport={platformSupport}
          value={antiCheat}
          onChange={onAntiCheatChange}
        />
      </section>
    </div>
  )
}
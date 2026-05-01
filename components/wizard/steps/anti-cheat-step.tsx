"use client"

import { useState, useEffect } from "react"
import { Shield, ShieldCheck, ShieldX, ShieldQuestion } from "lucide-react"
import { cn } from "@/lib/utils"

export type AntiCheatData = {
  antiCheatRelevant: boolean
  antiCheatName: string
  antiCheatStatus: "none" | "supported" | "unsupported" | "unknown"
}

interface PlatformSupportEntry {
  hardwareSlug: string
  antiCheatRelevant: boolean
  antiCheatStatus: "none" | "supported" | "unsupported" | "unknown"
  antiCheatName: string | null
}

interface AntiCheatStepProps {
  hardwareSlug: string
  platformSupport: PlatformSupportEntry[]
  value: AntiCheatData
  onChange: (data: AntiCheatData) => void
}

const statusConfig = {
  supported: {
    icon: ShieldCheck,
    label: "Supported",
    color: "border-green-500/30 bg-green-500/10",
    textColor: "text-green-400",
    message: "Anti-cheat works on Linux/SteamOS. Multiplayer should work.",
  },
  unsupported: {
    icon: ShieldX,
    label: "Unsupported",
    color: "border-red-500/30 bg-red-500/10",
    textColor: "text-red-400",
    message: "Anti-cheat does not support Linux/SteamOS. Multiplayer may not work.",
  },
  unknown: {
    icon: ShieldQuestion,
    label: "Unknown",
    color: "border-yellow-500/30 bg-yellow-500/10",
    textColor: "text-yellow-400",
    message: "Compatibility is unknown. Multiplayer may or may not work.",
  },
  none: {
    icon: Shield,
    label: "None",
    color: "border-zinc-500/30 bg-zinc-500/10",
    textColor: "text-zinc-400",
    message: "No anti-cheat detected.",
  },
} as const

export function AntiCheatStep({
  hardwareSlug,
  platformSupport,
  value,
  onChange,
}: AntiCheatStepProps) {
  const [isEditing] = useState(false)

  // Find the best existing entry to prefill:
  // Prefer the entry for the currently selected hardware,
  // otherwise fall back to any entry with anti-cheat data.
  const hardwareEntry = platformSupport.find(
    (p) => p.hardwareSlug === hardwareSlug && p.antiCheatRelevant
  )
  const anyEntry = platformSupport.find((p) => p.antiCheatRelevant)
  const existingEntry = hardwareEntry ?? anyEntry

  // Prefill once when the component mounts if the current value is the default
  useEffect(() => {
    if (existingEntry && !isEditing) {
      onChange({
        antiCheatRelevant: existingEntry.antiCheatRelevant,
        antiCheatName: existingEntry.antiCheatName ?? "",
        antiCheatStatus: existingEntry.antiCheatStatus,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardwareSlug]) // re-prefill when hardware changes

  const relevant = value.antiCheatRelevant
  const currentConfig = statusConfig[value.antiCheatStatus]
  const CurrentIcon = currentConfig.icon

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Anti-Cheat</h3>
          <p className="text-xs text-text/60 mt-1">
            Set the anti-cheat status for this game. This helps others know if multiplayer will work.
          </p>
        </div>
      </div>

      {/* Toggle: Has anti-cheat? */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              antiCheatRelevant: !relevant,
              antiCheatStatus: !relevant ? "unknown" : "none",
              antiCheatName: !relevant ? value.antiCheatName : "",
            })
          }
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            relevant ? "bg-primary" : "bg-text/20"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              relevant ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
        <div className="flex flex-col">
          <span className="text-sm text-text">Game uses anti-cheat</span>
          <span className="text-xs text-text/50">
            {relevant
              ? "Yes — select the anti-cheat name and compatibility below"
              : "No anti-cheat software detected in this game"}
          </span>
        </div>
      </div>

      {relevant && (
        <div className="space-y-4">
          {/* Anti-cheat name */}
          <div>
            <label className="block text-xs font-medium text-text/70 mb-1.5">
              Anti-Cheat Name
            </label>
            <input
              type="text"
              value={value.antiCheatName}
              onChange={(e) =>
                onChange({ ...value, antiCheatName: e.target.value })
              }
              placeholder="e.g. Easy Anti-Cheat, BattlEye, Ricochet"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-text placeholder:text-text/30 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Status radios */}
          <div>
            <label className="block text-xs font-medium text-text/70 mb-2">
              Compatibility on Linux / SteamOS
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  "supported",
                  "unsupported",
                  "unknown",
                ] as const
              ).map((status) => {
                const cfg = statusConfig[status]
                const Icon = cfg.icon
                const active = value.antiCheatStatus === status
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      onChange({ ...value, antiCheatStatus: status })
                    }
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors",
                      active
                        ? cfg.color
                        : "border-border bg-text/[0.02] hover:bg-text/5"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? cfg.textColor : "text-text/30"
                      )}
                    />
                    <span
                      className={cn(
                        "text-xs font-medium",
                        active ? cfg.textColor : "text-text/60"
                      )}
                    >
                      {cfg.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Preview card */}
      <div
        className={cn(
          "rounded-lg border p-4",
          currentConfig.color
        )}
      >
        <div className="flex items-center gap-2">
          <CurrentIcon className={cn("h-5 w-5", currentConfig.textColor)} />
          <h4 className="font-medium text-sm">
            {relevant && value.antiCheatName
              ? value.antiCheatName
              : currentConfig.label}
          </h4>
        </div>
        <p className={cn("mt-2 text-sm", currentConfig.textColor)}>
          {currentConfig.message}
        </p>
      </div>
    </div>
  )
}

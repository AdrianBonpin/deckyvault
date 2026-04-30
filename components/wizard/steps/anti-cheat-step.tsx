"use client"

import { Shield, ShieldCheck, ShieldX, ShieldQuestion } from "lucide-react"
import { cn } from "@/lib/utils"

interface PlatformSupportEntry {
  hardwareSlug: string
  antiCheatRelevant: boolean
  antiCheatStatus: "none" | "supported" | "unsupported" | "unknown"
  antiCheatName: string | null
}

interface AntiCheatStepProps {
  hardwareSlug: string
  platformSupport: PlatformSupportEntry[]
}

const statusConfig = {
  supported: {
    icon: ShieldCheck,
    label: "Supported",
    color: "border-green-500/30 bg-green-500/10",
    textColor: "text-green-400",
    message:
      "This game's anti-cheat supports Linux/SteamOS. Multiplayer should work.",
  },
  unsupported: {
    icon: ShieldX,
    label: "Unsupported",
    color: "border-red-500/30 bg-red-500/10",
    textColor: "text-red-400",
    message:
      "This game's anti-cheat does not support Linux/SteamOS. Multiplayer may not work.",
  },
  unknown: {
    icon: ShieldQuestion,
    label: "Unknown",
    color: "border-yellow-500/30 bg-yellow-500/10",
    textColor: "text-yellow-400",
    message:
      "Anti-cheat compatibility is unknown. Multiplayer may or may not work.",
  },
  none: {
    icon: Shield,
    label: "None",
    color: "border-zinc-500/30 bg-zinc-500/10",
    textColor: "text-zinc-400",
    message: "No anti-cheat detected for this game.",
  },
} as const

export function AntiCheatStep({
  hardwareSlug,
  platformSupport,
}: AntiCheatStepProps) {
  // Anti-cheat is a game-level property, not device-specific.
  // Find the first entry with anti-cheat info (any device).
  const antiCheatEntry = platformSupport.find((p) => p.antiCheatRelevant)

  if (!antiCheatEntry) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 text-text mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-text">
              Anti-Cheat Status
            </h3>
            <p className="text-xs text-text/60 mt-1">
              Check the anti-cheat compatibility before submitting.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-500/30 bg-zinc-500/10 p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-zinc-400" />
            <h4 className="font-medium">No Anti-Cheat</h4>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            This game does not use anti-cheat software. Multiplayer (if
            available) should work without issues.
          </p>
        </div>
      </div>
    )
  }

  const config = statusConfig[antiCheatEntry.antiCheatStatus]
  const Icon = config.icon

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Anti-Cheat Status</h3>
          <p className="text-xs text-text/60 mt-1">
            Check the anti-cheat compatibility before submitting.
          </p>
        </div>
      </div>

      <div className={cn("rounded-lg border p-4", config.color)}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", config.textColor)} />
          <h4 className="font-medium">
            Anti-Cheat: {antiCheatEntry.antiCheatName || config.label}
          </h4>
        </div>
        <p className={cn("mt-2 text-sm", config.textColor)}>{config.message}</p>
      </div>
    </div>
  )
}

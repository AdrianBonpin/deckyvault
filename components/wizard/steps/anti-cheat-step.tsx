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
    message: "This game's anti-cheat supports Linux/SteamOS. Multiplayer should work.",
  },
  unsupported: {
    icon: ShieldX,
    label: "Unsupported",
    color: "border-red-500/30 bg-red-500/10",
    textColor: "text-red-400",
    message: "This game's anti-cheat does not support Linux/SteamOS. Multiplayer may not work.",
  },
  unknown: {
    icon: ShieldQuestion,
    label: "Unknown",
    color: "border-yellow-500/30 bg-yellow-500/10",
    textColor: "text-yellow-400",
    message: "Anti-cheat compatibility is unknown. Multiplayer may or may not work.",
  },
  none: {
    icon: Shield,
    label: "None",
    color: "border-zinc-500/30 bg-zinc-500/10",
    textColor: "text-zinc-400",
    message: "No anti-cheat detected for this game.",
  },
} as const

export function AntiCheatStep({ hardwareSlug, platformSupport }: AntiCheatStepProps) {
  const support = platformSupport.find((p) => p.hardwareSlug === hardwareSlug)

  if (!hardwareSlug) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Shield className="h-8 w-8 text-text/30 mb-4" />
        <p className="text-sm text-text/60">Please select a hardware device first.</p>
      </div>
    )
  }

  if (!support || !support.antiCheatRelevant) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Shield className="h-8 w-8 text-text/30 mb-4" />
        <p className="text-sm text-text/60">No anti-cheat information for this hardware device.</p>
      </div>
    )
  }

  const config = statusConfig[support.antiCheatStatus]
  const Icon = config.icon

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Anti-Cheat Status</h3>
          <p className="text-xs text-text/60 mt-1">
            Check the anti-cheat compatibility for your selected hardware before submitting.
          </p>
        </div>
      </div>

      <div className={cn("rounded-lg border p-4", config.color)}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", config.textColor)} />
          <h4 className="font-medium">
            Anti-Cheat: {support.antiCheatName || config.label}
          </h4>
        </div>
        <p className={cn("mt-2 text-sm", config.textColor)}>{config.message}</p>
      </div>
    </div>
  )
}

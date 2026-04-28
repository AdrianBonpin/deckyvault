"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Monitor, Gamepad2, Loader2 } from "lucide-react"

interface HardwareDevice {
  slug: string
  name: string
  deviceType: string
}

export interface PlatformSupportItem {
  hardwareSlug: string
  isSupported: boolean
  protonStatus: "native" | "proton" | "unsupported" | "unknown"
}

interface NonSteamPlatformStepProps {
  value: PlatformSupportItem[]
  onChange: (value: PlatformSupportItem[]) => void
}

const PROTON_OPTIONS: { value: PlatformSupportItem["protonStatus"]; label: string }[] = [
  { value: "native", label: "Native" },
  { value: "proton", label: "Proton" },
  { value: "unsupported", label: "Unsupported" },
  { value: "unknown", label: "Unknown" },
]

export function NonSteamPlatformStep({ value, onChange }: NonSteamPlatformStepProps) {
  const [devices, setDevices] = useState<HardwareDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchHardware() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch("/api/performance/hardware")
        if (!res.ok) throw new Error("Failed to load hardware")
        const data = await res.json()
        if (!cancelled) {
          setDevices(data.data || [])
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load hardware devices")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchHardware()
    return () => { cancelled = true }
  }, [])

  const getItem = (slug: string): PlatformSupportItem => {
    return (
      value.find((v) => v.hardwareSlug === slug) || {
        hardwareSlug: slug,
        isSupported: false,
        protonStatus: "unknown",
      }
    )
  }

  const updateItem = (slug: string, patch: Partial<PlatformSupportItem>) => {
    const existing = value.find((v) => v.hardwareSlug === slug)
    let next: PlatformSupportItem[]
    if (existing) {
      next = value.map((v) =>
        v.hardwareSlug === slug ? { ...v, ...patch } : v
      )
    } else {
      next = [
        ...value,
        {
          hardwareSlug: slug,
          isSupported: patch.isSupported ?? false,
          protonStatus: patch.protonStatus ?? "unknown",
        },
      ]
    }
    onChange(next)
  }

  const toggleSupported = (slug: string) => {
    const item = getItem(slug)
    updateItem(slug, { isSupported: !item.isSupported })
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-text/60">Loading hardware devices...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Monitor className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Platform Support</h3>
          <p className="text-xs text-text/60 mt-1">
            Select devices this game supports and its Proton status.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {devices.map((device) => {
          const item = getItem(device.slug)
          const Icon = device.deviceType === "console" ? Gamepad2 : Monitor

          return (
            <motion.div
              key={device.slug}
              layout
              className={`rounded-lg border p-4 transition-colors ${
                item.isSupported
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-text/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-lg ${
                      item.isSupported
                        ? "bg-primary/15 text-primary"
                        : "bg-text/10 text-text/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{device.name}</p>
                    <p className="text-[11px] text-text/40 capitalize">
                      {device.deviceType}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSupported(device.slug)}
                  className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
                    item.isSupported ? "bg-primary" : "bg-text/20"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out mt-0.5 ${
                      item.isSupported ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <AnimatePresence>
                {item.isSupported && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-border/50 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-text/60">
                        Proton Status
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {PROTON_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              updateItem(device.slug, { protonStatus: opt.value })
                            }
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                              item.protonStatus === opt.value
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-text/5 text-text/60 hover:bg-text/10"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}

        {devices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg bg-text/5">
            <p className="text-sm text-text/50">No hardware devices available</p>
          </div>
        )}
      </div>
    </div>
  )
}

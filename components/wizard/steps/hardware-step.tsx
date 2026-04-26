"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Monitor, Gamepad2, Loader2 } from "lucide-react"
import { api } from "@/lib/eden"

interface HardwareDevice {
  slug: string
  name: string
  deviceType: string
}

interface HardwareStepProps {
  value: string
  onChange: (slug: string) => void
}

export function HardwareStep({ value, onChange }: HardwareStepProps) {
  const [devices, setDevices] = useState<HardwareDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchHardware() {
      try {
        setLoading(true)
        setError(null)
        const res = await api.performance.hardware.get()
        if (cancelled) return

        if (res.error) {
          setError("Failed to load hardware devices")
          setDevices([])
        } else {
          setDevices(res.data?.data ?? [])
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load hardware devices")
          setDevices([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchHardware()

    return () => {
      cancelled = true
    }
  }, [])

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
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text/60">
        Select the hardware device you used to test this game.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {devices.map((device) => {
          const isSelected = device.slug === value
          const Icon = device.deviceType === "console" ? Gamepad2 : Monitor

          return (
            <motion.button
              key={device.slug}
              type="button"
              onClick={() => onChange(device.slug)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative flex items-center gap-3 p-4 rounded-lg border transition-colors text-left cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                  : "border-border bg-text/5 hover:bg-text/10 hover:border-border-active"
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  isSelected ? "bg-primary/20 text-primary" : "bg-text/10 text-text/50"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">
                  {device.name}
                </p>
                <p className="text-xs text-text/40 capitalize">
                  {device.deviceType}
                </p>
              </div>

              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0"
                >
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>

      {devices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg bg-text/5">
          <p className="text-sm text-text/50">No hardware devices available</p>
        </div>
      )}
    </div>
  )
}

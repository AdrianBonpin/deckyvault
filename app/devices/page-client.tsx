"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { Gamepad2Icon, TrendingUpIcon, DatabaseIcon, ArrowRightIcon, Loader2 } from "lucide-react"

interface DeviceStats {
  slug: string
  name: string
  deviceType: string
  sortOrder: number
  totalBenchmarks: number
  avgFps: number | null
  gameCount: number
  verifiedCount: number
  bestGame: {
    id: string
    title: string
    headerImage: string | null
    fpsAvg: number
  } | null
}

const deviceTypeLabel: Record<string, string> = {
  handheld: "Handheld",
  console: "Console",
}

export function DevicesPageClient() {
  const [devices, setDevices] = useState<DeviceStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDevices() {
      try {
        const res = await fetch("/api/hardware/stats")
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setDevices(data)
      } catch (err) {
        setError("Failed to load devices")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchDevices()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-[10svw] py-8">
        <div className="text-center py-16 text-text/40">
          <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-[10svw] py-8">
        <div className="text-center py-16 text-text/40">
          <Gamepad2Icon className="h-10 w-10 mx-auto mb-2" />
          <p>No devices found</p>
          <p className="text-sm mt-1">Benchmark data will appear as devices are added</p>
        </div>
      </div>
    )
  }

  return (
    <section className="w-full flex flex-col gap-8 pb-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold">Devices</h1>
          <p className="text-sm text-text/60 mt-1">
            Browse benchmark data for handheld and console devices
          </p>
        </div>
      </motion.div>

      {/* Device Grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="px-4 md:px-[10svw]"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device, i) => (
            <motion.div
              key={device.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 * i }}
            >
              <Link
                href={`/devices/${device.slug}`}
                className="block p-5 rounded-xl border border-border bg-text/[0.03] hover:border-primary/30 transition-colors group"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
                      {device.name}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary/20 text-secondary border border-secondary/30 capitalize mt-1">
                      <Gamepad2Icon className="h-2.5 w-2.5" />
                      {deviceTypeLabel[device.deviceType] || device.deviceType}
                    </span>
                  </div>
                  <ArrowRightIcon className="h-5 w-5 text-text/20 group-hover:text-primary transition-colors" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="flex flex-col items-center text-center">
                    <DatabaseIcon className="h-4 w-4 text-primary mb-1" />
                    <span className="text-lg font-bold tabular-nums">{device.totalBenchmarks}</span>
                    <span className="text-[10px] text-text/50">Benchmarks</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <TrendingUpIcon className="h-4 w-4 text-green-400 mb-1" />
                    <span className="text-lg font-bold tabular-nums">
                      {device.avgFps !== null ? device.avgFps : "—"}
                    </span>
                    <span className="text-[10px] text-text/50">Avg FPS</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <Gamepad2Icon className="h-4 w-4 text-accent mb-1" />
                    <span className="text-lg font-bold tabular-nums">{device.gameCount}</span>
                    <span className="text-[10px] text-text/50">Games</span>
                  </div>
                </div>

                {/* Best game */}
                {device.bestGame && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-text/50">
                    Top: <span className="text-text/80 font-medium">{device.bestGame.title}</span> · {device.bestGame.fpsAvg} FPS
                  </div>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}

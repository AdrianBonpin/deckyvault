"use client"

import { useMemo } from "react"
import { Gauge, Timer } from "lucide-react"

export interface PerformanceData {
  fpsAvg?: number
  fpsLow?: number
  fpsHigh?: number
  loadTimeSsd?: number
  loadTimeSd?: number
}

interface PerformanceStepProps {
  value: PerformanceData
  onChange: (value: PerformanceData) => void
}

export function PerformanceStep({ value, onChange }: PerformanceStepProps) {
  const error = useMemo(() => {
    if (value.fpsAvg !== undefined && value.fpsAvg !== null && value.fpsAvg <= 0) {
      return "FPS Average must be greater than 0"
    }
    return null
  }, [value.fpsAvg])

  const update = (field: keyof PerformanceData, val: string) => {
    const num = val === "" ? undefined : Number(val)
    onChange({ ...value, [field]: num })
  }

  return (
    <div className="space-y-6">
      {/* FPS Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-text">Frame Rate</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">
              FPS Average <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={value.fpsAvg ?? ""}
              onChange={(e) => update("fpsAvg", e.target.value)}
              placeholder="e.g. 45"
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">FPS Low</label>
            <input
              type="number"
              min={1}
              step={1}
              value={value.fpsLow ?? ""}
              onChange={(e) => update("fpsLow", e.target.value)}
              placeholder="e.g. 30"
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">FPS High</label>
            <input
              type="number"
              min={1}
              step={1}
              value={value.fpsHigh ?? ""}
              onChange={(e) => update("fpsHigh", e.target.value)}
              placeholder="e.g. 60"
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* Load Time Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-text">Load Times</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Load Time SSD (seconds)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={value.loadTimeSsd ?? ""}
              onChange={(e) => update("loadTimeSsd", e.target.value)}
              placeholder="e.g. 12.5"
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Load Time SD Card (seconds)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={value.loadTimeSd ?? ""}
              onChange={(e) => update("loadTimeSd", e.target.value)}
              placeholder="e.g. 35.0"
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { motion } from "motion/react"
import { Send, Loader2, AlertCircle, Monitor, Gauge, SlidersHorizontal, Terminal, FileText, ImagePlus, X } from "lucide-react"
import { TiptapEditor } from "@/components/tiptap-editor"
import type { SettingCategory } from "@/components/wizard/settings-editor"
import type { PerformanceData } from "./performance-step"
import type { EnvironmentData } from "./environment-step"
import { UPSCALER_TYPE_OPTIONS, FRAME_GEN_OPTIONS } from "./environment-step"

export interface ReviewData {
  hardwareSlug: string
  hardwareName: string
  hardwareWattHours: number | null
  hardwareDeviceType: string | null
  gameVersionLabel: string
  antiCheat: {
    antiCheatRelevant: boolean
    antiCheatName: string
    antiCheatStatus: "none" | "supported" | "unsupported" | "unknown"
  }
  performance: PerformanceData
  settings: SettingCategory[]
  environment: EnvironmentData
}

interface ReviewStepProps {
  data: ReviewData
  userNotes: string
  onUserNotesChange: (notes: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  error: string | null
  screenshotFiles: File[]
  onScreenshotFilesChange: (files: File[]) => void
  submitPhase: "idle" | "uploading" | "saving" | "success" | "error"
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold text-text/80 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-b-0">
      <span className="text-xs text-text/50">{label}</span>
      <span className="text-xs text-text font-medium">{value}</span>
    </div>
  )
}

function formatNumber(val: number | undefined): string {
  if (val === undefined || val === null) return "Not set"
  return String(val)
}

export function ReviewStep({
  data,
  userNotes,
  onUserNotesChange,
  onSubmit,
  isSubmitting,
  error,
  screenshotFiles,
  onScreenshotFilesChange,
  submitPhase,
}: ReviewStepProps) {
  const { hardwareName, gameVersionLabel, antiCheat, performance, environment, settings } = data

  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([])

  useEffect(() => {
    if (!screenshotFiles?.length) {
      setPreviews([])
      return
    }
    const next = screenshotFiles.map((file) => ({ file, url: URL.createObjectURL(file) }))
    setPreviews(next)
    return () => {
      next.forEach((p) => URL.revokeObjectURL(p.url))
    }
  }, [screenshotFiles])

  const upscalerLabel = (() => {
    if (!data.environment.upscalerType || data.environment.upscalerType === "none") return "None"
    const opt = UPSCALER_TYPE_OPTIONS.find(o => o.value === data.environment.upscalerType)
    const base = opt?.label ?? data.environment.upscalerType
    return data.environment.upscalerVersion ? `${base} ${data.environment.upscalerVersion}` : base
  })()

  const frameGenLabel = (() => {
    if (!environment.frameGenMethod || environment.frameGenMethod === "none") return "None"
    const opt = FRAME_GEN_OPTIONS.find(o => o.value === environment.frameGenMethod)
    return opt?.label ?? environment.frameGenMethod
  })()

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Review & Submit</h3>
          <p className="text-xs text-text/60 mt-1">
            Review your submission details below. Add any additional notes and click Submit when ready.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Setup: Hardware + Version + Anti-Cheat */}
        <div className="rounded-lg border border-border bg-text/5 p-4">
          <SectionHeader icon={Monitor} label="Setup" />
          <SummaryRow label="Device" value={hardwareName || data.hardwareSlug || "Not selected"} />
          <SummaryRow label="Game Version" value={gameVersionLabel} />
          {antiCheat.antiCheatRelevant && (
            <>
              <SummaryRow label="Anti-Cheat" value={antiCheat.antiCheatName || "Unknown"} />
              <SummaryRow label="Anti-Cheat Status" value={
                antiCheat.antiCheatStatus === "supported" ? "Supported" :
                antiCheat.antiCheatStatus === "unsupported" ? "Unsupported" :
                antiCheat.antiCheatStatus === "unknown" ? "Unknown" : "None"
              } />
            </>
          )}
          {!antiCheat.antiCheatRelevant && (
            <SummaryRow label="Anti-Cheat" value="None" />
          )}
        </div>

        {/* Performance */}
        <div className="rounded-lg border border-border bg-text/5 p-4">
          <SectionHeader icon={Gauge} label="Performance" />
          <SummaryRow label="FPS Average" value={formatNumber(performance.fpsAvg)} />
          <SummaryRow label="1% Low FPS" value={formatNumber(performance.fpsOnePercentLow)} />
          <SummaryRow label="FPS Low" value={formatNumber(performance.fpsLow)} />
          <SummaryRow label="FPS High" value={formatNumber(performance.fpsHigh)} />
          <SummaryRow label="Load Time SSD" value={formatNumber(performance.loadTimeSsd)} />
          <SummaryRow label="Load Time SD" value={formatNumber(performance.loadTimeSd)} />
          <SummaryRow label="TDP (Watts)" value={formatNumber(performance.tdpWatts)} />
          <SummaryRow
            label="Est. Battery"
            value={(() => {
              const wh = data.hardwareWattHours
              const tdp = performance.tdpWatts
              if (wh && tdp && tdp > 0 && data.hardwareDeviceType === "handheld") {
                const hours = wh / tdp
                const mins = Math.round(hours * 60)
                return `~${hours.toFixed(1)}h (${mins} min)`
              }
              return "Not available — requires TDP and a handheld device"
            })()}
          />
        </div>

        {/* Environment */}
        <div className="rounded-lg border border-border bg-text/5 p-4">
          <SectionHeader icon={Terminal} label="Environment" />
          <SummaryRow label="Proton Version" value={environment.protonVersion || "Not set"} />
          <SummaryRow label="OS Version" value={environment.osVersion || "Not set"} />
          <SummaryRow label="Upscaler" value={upscalerLabel} />
          <SummaryRow label="Frame Gen" value={frameGenLabel} />
          <SummaryRow label="Custom System" value={environment.customSystem ? "Yes" : "No"} />
          {environment.launchOptions && (
            <SummaryRow
              label="Launch Options"
              value={
                <span className="font-mono text-[10px] truncate max-w-[160px] block" title={environment.launchOptions}>
                  {environment.launchOptions}
                </span>
              }
            />
          )}
          <SummaryRow label="YouTube Video" value={environment.youtubeVideoId || "Not set"} />
        </div>

        {/* Settings */}
        <div className="rounded-lg border border-border bg-text/5 p-4">
          <SectionHeader icon={SlidersHorizontal} label="Settings" />
          {settings.length === 0 ? (
            <p className="text-xs text-text/40 py-1">No settings configured</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {settings.map((cat) => (
                <div key={cat.category}>
                  <p className="text-xs font-medium text-text/70">{cat.category}</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {cat.settings.map((s) => (
                      <span
                        key={s.title}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-text/10 text-text/60"
                      >
                        {s.title}: {String(s.value)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screenshots */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text/60">Screenshots</label>
        {data.settings.length === 0 ? (
          <div className="rounded-lg border border-border bg-text/5 p-4">
            <p className="text-xs text-text/50">Add game settings to enable screenshot upload</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-text/5 p-4 space-y-3">
            {(submitPhase === "uploading" || submitPhase === "saving") && (
              <div className="flex items-center gap-2 text-xs text-text/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}

            {previews.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {previews.map((preview) => (
                  <div
                    key={preview.url}
                    className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden border border-border bg-text/10"
                  >
                    <img
                      src={preview.url}
                      alt={preview.file.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newFiles = (screenshotFiles || []).filter((f) => f !== preview.file)
                        onScreenshotFilesChange?.(newFiles)
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(!screenshotFiles || screenshotFiles.length < 2) && submitPhase !== "uploading" && submitPhase !== "saving" && (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border bg-text/5 hover:bg-text/10 transition-colors cursor-pointer">
                <ImagePlus className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-text/70">
                  {(!screenshotFiles || screenshotFiles.length === 0) ? "Add screenshots" : "Add another screenshot"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).filter((f) =>
                      /image\/(jpeg|png|webp)/.test(f.type)
                    )
                    const current = screenshotFiles || []
                    const combined = [...current, ...files].slice(0, 2)
                    onScreenshotFilesChange?.(combined)
                    e.target.value = ""
                  }}
                  className="sr-only"
                />
              </label>
            )}

            {screenshotFiles && screenshotFiles.length >= 2 && (
              <p className="text-xs text-text/50">Maximum 2 screenshots reached</p>
            )}


          </div>
        )}
      </div>

      {/* User Notes */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-text/60">Additional Notes</label>
        <TiptapEditor
          content={userNotes}
          onChange={(json) => onUserNotesChange(JSON.stringify(json))}
          placeholder="Add any extra details about your experience..."
        />
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
        >
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </motion.div>
      )}

      {/* Submit Button */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Submit Entry
          </>
        )}
      </button>
    </div>
  )
}

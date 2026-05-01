"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { StepIndicator } from "@/components/wizard/step-indicator"
import { SetupStep, type GameVersionInfo } from "@/components/wizard/steps/setup-step"
import { type AntiCheatData } from "@/components/wizard/steps/anti-cheat-step"
import { PerformanceStep, type PerformanceData } from "@/components/wizard/steps/performance-step"
import { SettingsStep } from "@/components/wizard/steps/settings-step"
import { EnvironmentStep, type EnvironmentData } from "@/components/wizard/steps/environment-step"
import { ReviewStep } from "@/components/wizard/steps/review-step"
import type { SettingCategory } from "@/components/wizard/settings-editor"
import { performanceEntries } from "@/lib/db/schema"

// Export GameVersionInfo so the server page can use it
export type { GameVersionInfo }

const STEPS = [
  { label: "Setup", tooltip: "Choose the hardware, game version, and anti-cheat status" },
  { label: "Performance", tooltip: "Enter the performance metrics you observed. FPS Average is required." },
  { label: "Settings", tooltip: "Configure the game settings you used. Add categories and settings to help others replicate your setup." },
  { label: "Environment", tooltip: "Specify the software environment and any launch options used" },
  { label: "Review", tooltip: "Review your entry before submitting. Add any additional notes." },
]

interface PlatformSupportEntry {
  hardwareSlug: string
  antiCheatRelevant: boolean
  antiCheatName: string | null
  antiCheatStatus: "none" | "supported" | "unsupported" | "unknown"
}

interface GameEntryWizardProps {
  gameId: string
  gameVersions: GameVersionInfo[]
  defaultVersionId: string
  editEntry?: typeof performanceEntries.$inferSelect | null
  platformSupport: PlatformSupportEntry[]
}

export function GameEntryWizard({ gameId, gameVersions, defaultVersionId, editEntry, platformSupport }: GameEntryWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Step 0: Setup — Hardware
  const [hardwareSlug, setHardwareSlug] = useState(editEntry?.hardwareSlug ?? "")
  const [hardwareName, setHardwareName] = useState("")

  // Step 0: Setup — Game Version
  const [selectedVersionId, setSelectedVersionId] = useState(defaultVersionId)
  const [newVersionString, setNewVersionString] = useState("")
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)

  // Step 0: Setup — Anti-Cheat
  const [antiCheat, setAntiCheat] = useState<AntiCheatData>({
    antiCheatRelevant: false,
    antiCheatName: "",
    antiCheatStatus: "none",
  })

  // Initialize anti-cheat from existing platformSupport when editing
  useEffect(() => {
    const entry = platformSupport.find(
      (p) => p.hardwareSlug === hardwareSlug && p.antiCheatRelevant
    ) ?? platformSupport.find((p) => p.antiCheatRelevant)

    if (entry) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAntiCheat({
        antiCheatRelevant: entry.antiCheatRelevant,
        antiCheatName: entry.antiCheatName ?? "",
        antiCheatStatus: entry.antiCheatStatus,
      })
    } else {
      setAntiCheat({
        antiCheatRelevant: false,
        antiCheatName: "",
        antiCheatStatus: "none",
      })
    }
  }, [hardwareSlug, platformSupport])

  // Step 1: Performance
  const [performance, setPerformance] = useState<PerformanceData>(
    editEntry
      ? {
          fpsAvg: editEntry.fpsAvg,
          fpsOnePercentLow: editEntry.fpsOnePercentLow ?? undefined,
          fpsLow: editEntry.fpsLow ?? undefined,
          fpsHigh: editEntry.fpsHigh ?? undefined,
          loadTimeSsd: editEntry.loadTimeSsd ?? undefined,
          loadTimeSd: editEntry.loadTimeSd ?? undefined,
        }
      : {},
  )

  // Step 2: Settings
  const [settingsJson, setSettingsJson] = useState<SettingCategory[]>(
    editEntry?.settingsJson ?? [],
  )

  // Step 3: Environment
  const [environment, setEnvironment] = useState<EnvironmentData>(
    editEntry
      ? {
          protonVersion: editEntry.protonVersion ?? undefined,
          osVersion: editEntry.osVersion ?? undefined,
          upscalerType: editEntry.upscalerType ?? "none",
          upscalerVersion: editEntry.upscalerVersion ?? undefined,
          frameGenMethod: editEntry.frameGenMethod ?? "none",
          launchOptions: editEntry.launchOptions ?? undefined,
          estimatedBatteryMin: editEntry.estimatedBatteryMin ?? undefined,
          customSystem: editEntry.customSystem ?? false,
        }
      : {
          upscalerType: "none",
          frameGenMethod: "none",
        },
  )

  // Step 4: Notes
  const [userNotes, setUserNotes] = useState(editEntry?.userNotes ?? "")

  // Fetch hardware name when slug changes
  const handleHardwareChange = useCallback(async (slug: string) => {
    setHardwareSlug(slug)
    if (!slug) {
      setHardwareName("")
      return
    }
    try {
      const res = await fetch("/api/performance/hardware")
      if (res.ok) {
        const data = await res.json() as { data: Array<{ slug: string; name: string }> }
        const device = data.data.find((d) => d.slug === slug)
        if (device) setHardwareName(device.name)
      }
    } catch {
      // ignore
    }
  }, [])

  // Fetch hardware name when in edit mode
  useEffect(() => {
    if (!editEntry || !hardwareSlug) return
    let cancelled = false
    async function fetchName() {
      try {
        const res = await fetch("/api/performance/hardware")
        if (res.ok && !cancelled) {
          const data = await res.json() as { data: Array<{ slug: string; name: string }> }
          const device = data.data.find((d) => d.slug === hardwareSlug)
          if (device && !cancelled) setHardwareName(device.name)
        }
      } catch {
        // ignore
      }
    }
    fetchName()
    return () => { cancelled = true }
  }, [editEntry, hardwareSlug])

  // Resolve the version label for display
  const getVersionLabel = useCallback(() => {
    if (selectedVersionId === "__new__") {
      return newVersionString || "New version"
    }
    const v = gameVersions.find((v) => v.id === selectedVersionId)
    if (!v) return "Unknown"
    return v.versionString || (v.buildId ? `Build ${v.buildId}` : "Unknown version")
  }, [selectedVersionId, newVersionString, gameVersions])

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Setup
        if (hardwareSlug === "") return false
        // If new version selected, require version string
        if (selectedVersionId === "__new__" && !newVersionString.trim()) return false
        return true
      case 1: // Performance
        return performance.fpsAvg !== undefined && performance.fpsAvg > 0
      case 2: // Settings
        return true
      case 3: // Environment
        return true
      case 4: // Review
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepClick = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step)
    }
  }

  // Resolve the final version ID — create a new version if needed
  const resolveVersionId = async (): Promise<string> => {
    if (selectedVersionId !== "__new__") {
      return selectedVersionId
    }

    // Create a new version via API
    setIsCreatingVersion(true)
    try {
      const res = await fetch(`/api/games/${gameId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionString: newVersionString.trim(),
          isLatest: false,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create game version")
      }

      const data = await res.json() as { data: { id: string } }
      return data.data.id
    } finally {
      setIsCreatingVersion(false)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Resolve version ID (may create a new version)
      const versionId = await resolveVersionId()

      const payload = {
        versionId,
        hardwareSlug,
        fpsAvg: Number(performance.fpsAvg),
        fpsOnePercentLow: performance.fpsOnePercentLow !== undefined ? Number(performance.fpsOnePercentLow) : null,
        fpsLow: performance.fpsLow !== undefined ? Number(performance.fpsLow) : null,
        fpsHigh: performance.fpsHigh !== undefined ? Number(performance.fpsHigh) : null,
        loadTimeSsd: performance.loadTimeSsd !== undefined ? Number(performance.loadTimeSsd) : null,
        loadTimeSd: performance.loadTimeSd !== undefined ? Number(performance.loadTimeSd) : null,
        protonVersion: environment.protonVersion || null,
        osVersion: environment.osVersion || null,
        upscalerType: environment.upscalerType ?? "none",
        upscalerVersion: environment.upscalerVersion || null,
        frameGenMethod: environment.frameGenMethod ?? "none",
        launchOptions: environment.launchOptions || null,
        estimatedBatteryMin: environment.estimatedBatteryMin ?? null,
        customSystem: environment.customSystem ?? false,
        settingsJson: settingsJson.length > 0 ? settingsJson : null,
        userNotes: userNotes || null,
        antiCheatRelevant: antiCheat.antiCheatRelevant,
        antiCheatName: antiCheat.antiCheatName || null,
        antiCheatStatus: antiCheat.antiCheatStatus,
      }

      const url = editEntry
        ? `/api/performance/${editEntry.id}/edit`
        : "/api/performance/submit"
      const method = editEntry ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Failed to ${editEntry ? "update" : "submit"} entry`)
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/game/${gameId}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Entry Submitted!</h2>
        <p className="text-sm text-text/60">Redirecting to game page...</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Step Indicator */}
      <StepIndicator
        steps={STEPS}
        currentStep={currentStep}
        onStepClick={handleStepClick}
      />

      <div className="flex items-center gap-1 text-xs text-text/40">
        <span className="text-red-400">*</span> Required fields
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="min-h-[300px]"
        >
          {currentStep === 0 && (
            <SetupStep
              gameId={gameId}
              gameVersions={gameVersions}
              hardwareSlug={hardwareSlug}
              onHardwareChange={handleHardwareChange}
              hardwareName={hardwareName}
              selectedVersionId={selectedVersionId}
              onVersionChange={setSelectedVersionId}
              newVersionString={newVersionString}
              onNewVersionStringChange={setNewVersionString}
              isCreatingVersion={isCreatingVersion}
              antiCheat={antiCheat}
              onAntiCheatChange={setAntiCheat}
              platformSupport={platformSupport}
            />
          )}
          {currentStep === 1 && (
            <PerformanceStep value={performance} onChange={setPerformance} />
          )}
          {currentStep === 2 && (
            <SettingsStep value={settingsJson} onChange={setSettingsJson} />
          )}
          {currentStep === 3 && (
            <EnvironmentStep value={environment} onChange={setEnvironment} />
          )}
          {currentStep === 4 && (
            <ReviewStep
              data={{
                hardwareSlug,
                hardwareName,
                gameVersionLabel: getVersionLabel(),
                antiCheat,
                performance,
                settings: settingsJson,
                environment,
              }}
              userNotes={userNotes}
              onUserNotesChange={setUserNotes}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              error={error}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      {currentStep < 4 && (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-6 py-2 rounded-lg border border-border text-sm font-medium text-text/70 hover:bg-text/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
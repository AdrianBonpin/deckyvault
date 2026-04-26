"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { StepIndicator } from "@/components/wizard/step-indicator"
import { HardwareStep } from "@/components/wizard/steps/hardware-step"
import { PerformanceStep, type PerformanceData } from "@/components/wizard/steps/performance-step"
import { SettingsStep } from "@/components/wizard/steps/settings-step"
import { EnvironmentStep, type EnvironmentData } from "@/components/wizard/steps/environment-step"
import { ReviewStep } from "@/components/wizard/steps/review-step"
import type { SettingCategory } from "@/components/wizard/settings-editor"

const STEPS = [
  { label: "Hardware", tooltip: "Choose the hardware you tested this game on" },
  { label: "Performance", tooltip: "Enter the performance metrics you observed. FPS Average is required." },
  { label: "Settings", tooltip: "Configure the game settings you used. Add categories and settings to help others replicate your setup." },
  { label: "Environment", tooltip: "Specify the software environment and any launch options used" },
  { label: "Review", tooltip: "Review your entry before submitting. Add any additional notes." },
]

interface GameEntryWizardProps {
  gameId: string
  gameVersionId: string
}

export function GameEntryWizard({ gameId, gameVersionId }: GameEntryWizardProps) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Step 1: Hardware
  const [hardwareSlug, setHardwareSlug] = useState("")
  const [hardwareName, setHardwareName] = useState("")

  // Step 2: Performance
  const [performance, setPerformance] = useState<PerformanceData>({})

  // Step 3: Settings
  const [settingsJson, setSettingsJson] = useState<SettingCategory[]>([])

  // Step 4: Environment
  const [environment, setEnvironment] = useState<EnvironmentData>({
    fsrVersion: "none",
    frameGenMethod: "none",
  })

  // Step 5: Notes
  const [userNotes, setUserNotes] = useState("")

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

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return hardwareSlug !== ""
      case 1:
        return performance.fpsAvg !== undefined && performance.fpsAvg > 0
      case 2:
        return true // Settings are optional
      case 3:
        return true // Environment is optional
      case 4:
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

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/performance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: gameVersionId,
          hardwareSlug,
          fpsAvg: Number(performance.fpsAvg),
          fpsLow: performance.fpsLow !== undefined ? Number(performance.fpsLow) : null,
          fpsHigh: performance.fpsHigh !== undefined ? Number(performance.fpsHigh) : null,
          loadTimeSsd: performance.loadTimeSsd !== undefined ? Number(performance.loadTimeSsd) : null,
          loadTimeSd: performance.loadTimeSd !== undefined ? Number(performance.loadTimeSd) : null,
          protonVersion: environment.protonVersion || null,
          osVersion: environment.osVersion || null,
          fsrVersion: environment.fsrVersion ?? "none",
          frameGenMethod: environment.frameGenMethod ?? "none",
          launchOptions: environment.launchOptions || null,
          settingsJson: settingsJson.length > 0 ? settingsJson : null,
          userNotes: userNotes || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to submit entry")
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
            <HardwareStep value={hardwareSlug} onChange={handleHardwareChange} />
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

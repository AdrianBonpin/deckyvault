"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { StepIndicator } from "./step-indicator"
import { NonSteamBasicInfoStep, BasicInfoData } from "./steps/non-steam-basic-info-step"
import { NonSteamImageStep } from "./steps/non-steam-image-step"
import { NonSteamPlatformStep, PlatformSupportItem } from "./steps/non-steam-platform-step"
import { NonSteamReviewStep } from "./steps/non-steam-review-step"

const STEPS = [
  { label: "Basic Info", tooltip: "Enter the game title, developer, publisher, and other details." },
  { label: "Cover Art", tooltip: "Search SteamGridDB for cover art or enter an image URL." },
  { label: "Platform Support", tooltip: "Select supported devices and Proton compatibility." },
  { label: "Review", tooltip: "Review all details before submitting the game." },
]

interface FormData {
  basicInfo: BasicInfoData
  headerImage: string
  capsuleImage: string
  platformSupport: PlatformSupportItem[]
}

export function NonSteamWizard() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    basicInfo: {
      title: "",
      developer: "",
      publisher: "",
      description: "",
      source: "manual",
      storeUrl: "",
      genres: [],
      releaseDate: "",
    },
    headerImage: "",
    capsuleImage: "",
    platformSupport: [],
  })

  const updateBasicInfo = useCallback(
    (value: BasicInfoData) => {
      setFormData((prev) => ({ ...prev, basicInfo: value }))
    },
    []
  )

  const updateImages = useCallback(
    (headerImage: string, capsuleImage: string) => {
      setFormData((prev) => ({ ...prev, headerImage, capsuleImage }))
    },
    []
  )

  const updatePlatformSupport = useCallback(
    (value: PlatformSupportItem[]) => {
      setFormData((prev) => ({ ...prev, platformSupport: value }))
    },
    []
  )

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const payload = {
        title: formData.basicInfo.title,
        developer: formData.basicInfo.developer || undefined,
        publisher: formData.basicInfo.publisher || undefined,
        description: formData.basicInfo.description || undefined,
        source: formData.basicInfo.source,
        storeUrl: formData.basicInfo.storeUrl || undefined,
        genres: formData.basicInfo.genres.length > 0 ? formData.basicInfo.genres : undefined,
        releaseDate: formData.basicInfo.releaseDate || undefined,
        headerImage: formData.headerImage || undefined,
        capsuleImage: formData.capsuleImage || undefined,
        platformSupport: formData.platformSupport.map((ps) => ({
          hardwareSlug: ps.hardwareSlug,
          isSupported: ps.isSupported,
          protonStatus: ps.protonStatus,
        })),
      }

      const res = await fetch("/api/games/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data.existingGame) {
          setError(`Game already exists: "${data.existingGame.title}". Redirecting...`)
          setTimeout(() => router.push(`/game/${data.existingGame.id}`), 2000)
          return
        }
        throw new Error(data.error || "Failed to create game")
      }

      setSuccess(true)
      setTimeout(() => router.push(`/game/${data.game.id}`), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game")
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.basicInfo.title.trim().length > 0
      default:
        return true
    }
  }

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleStepClick = (clickedStep: number) => {
    if (clickedStep <= step) {
      setStep(clickedStep)
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
        <h2 className="text-xl font-bold mb-2">Game Created!</h2>
        <p className="text-sm text-text/60">Redirecting to game page...</p>
      </motion.div>
    )
  }

  return (
    <div className="space-y-8">
      <StepIndicator steps={STEPS} currentStep={step} onStepClick={handleStepClick} />

      <div className="flex items-center gap-1 text-xs text-text/40">
        <span className="text-red-400">*</span> Required fields
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="min-h-[300px]"
        >
          {step === 0 && (
            <NonSteamBasicInfoStep
              value={formData.basicInfo}
              onChange={updateBasicInfo}
            />
          )}
          {step === 1 && (
            <NonSteamImageStep
              headerImage={formData.headerImage}
              capsuleImage={formData.capsuleImage}
              onChange={updateImages}
            />
          )}
          {step === 2 && (
            <NonSteamPlatformStep
              value={formData.platformSupport}
              onChange={updatePlatformSupport}
            />
          )}
          {step === 3 && (
            <NonSteamReviewStep
              basicInfo={formData.basicInfo}
              headerImage={formData.headerImage}
              capsuleImage={formData.capsuleImage}
              platformSupport={formData.platformSupport}
              onSubmit={handleSubmit}
              isSubmitting={loading}
              error={error}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Buttons */}
      {step < STEPS.length - 1 && (
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="px-6 py-2 rounded-lg border border-border text-sm font-medium text-text/70 hover:bg-text/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

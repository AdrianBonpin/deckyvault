"use client"

import { motion } from "motion/react"
import { Check, Info } from "lucide-react"
import { useState } from "react"

interface Step {
  label: string
  tooltip: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (step: number) => void
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
}: StepIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState<number | null>(null)

  return (
    <div className="w-full">
      {/* Desktop: horizontal steps */}
      <div className="hidden sm:flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isCurrent = index === currentStep
          const isClickable = index <= currentStep

          return (
            <div key={index} className="flex items-center flex-1">
              {/* Step circle with tooltip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick?.(index)}
                  onMouseEnter={() => setShowTooltip(index)}
                  onMouseLeave={() => setShowTooltip(null)}
                  disabled={!isClickable}
                  className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-all ${
                    isCompleted
                      ? "bg-primary text-white"
                      : isCurrent
                      ? "bg-primary/20 text-primary border-2 border-primary"
                      : "bg-text/10 text-text/40"
                  } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </button>

                {/* Tooltip */}
                {showTooltip === index && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-20 px-3 py-2 rounded-lg bg-[#1a1020] border border-white/10 shadow-lg w-48"
                  >
                    <p className="text-xs font-medium text-text mb-1">
                      {step.label}
                    </p>
                    <p className="text-xs text-text/60">{step.tooltip}</p>
                  </motion.div>
                )}
              </div>

              {/* Step label */}
              <span
                className={`ml-2 text-xs font-medium ${
                  isCurrent ? "text-text" : "text-text/40"
                }`}
              >
                {step.label}
              </span>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-3">
                  <div className="h-0.5 bg-text/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: isCompleted ? "100%" : "0%",
                      }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile: compact step indicator */}
      <div className="flex sm:hidden items-center justify-between">
        <span className="text-sm font-medium">
          Step {currentStep + 1} of {steps.length}
        </span>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(currentStep)}
            onMouseLeave={() => setShowTooltip(null)}
            className="text-text/40 hover:text-text transition-colors"
          >
            <Info className="h-4 w-4" />
          </button>
          {showTooltip === currentStep && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full mt-2 right-0 z-20 px-3 py-2 rounded-lg bg-[#1a1020] border border-white/10 shadow-lg w-48"
            >
              <p className="text-xs font-medium text-text mb-1">
                {steps[currentStep].label}
              </p>
              <p className="text-xs text-text/60">
                {steps[currentStep].tooltip}
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile: step dots */}
      <div className="flex sm:hidden items-center gap-1.5 mt-3">
        {steps.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => index <= currentStep && onStepClick?.(index)}
            className={`h-1.5 rounded-full transition-all ${
              index === currentStep
                ? "w-6 bg-primary"
                : index < currentStep
                ? "w-1.5 bg-primary/50"
                : "w-1.5 bg-text/20"
            }`}
          />
        ))}
      </div>
    </div>
  )
}

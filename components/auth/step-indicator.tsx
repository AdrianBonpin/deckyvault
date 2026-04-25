"use client"

import { motion } from "motion/react"

interface StepIndicatorProps {
    currentStep: number
    totalSteps: number
}

export default function StepIndicator({
    currentStep,
    totalSteps,
}: StepIndicatorProps) {
    return (
        <div className="flex gap-2 justify-center">
            {Array.from({ length: totalSteps }).map((_, i) => (
                <motion.div
                    key={i}
                    className="h-1 w-8 rounded-full"
                    initial={false}
                    animate={{
                        backgroundColor:
                            i < currentStep - 1
                                ? "#22c55e" // completed
                                : i === currentStep - 1
                                  ? "#eb3779" // current
                                  : "rgba(255,255,255,0.1)", // upcoming
                    }}
                    transition={{ duration: 0.3 }}
                />
            ))}
        </div>
    )
}

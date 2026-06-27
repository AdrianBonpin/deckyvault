"use client"

import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react"
import { motion } from "motion/react"
import {
    checkPasswordStrength,
    type StrengthLevel,
} from "@/lib/auth/password-strength"

interface PasswordStrengthProps {
    password: string
}

const levelColors: Record<StrengthLevel, string> = {
    weak: "#ef4444",
    fair: "#f59e0b",
    good: "#eab308",
    strong: "#22c55e",
    excellent: "#10b981",
}

const levelLabels: Record<StrengthLevel, string> = {
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
    excellent: "Excellent",
}

const levelBars: Record<StrengthLevel, number> = {
    weak: 1,
    fair: 2,
    good: 3,
    strong: 4,
    excellent: 5,
}

export default function PasswordStrengthMeter({
    password,
}: PasswordStrengthProps) {
    if (!password) return null

    const { level, feedback } = checkPasswordStrength(password)
    const color = levelColors[level]
    const bars = levelBars[level]

    return (
        <div className="mt-2">
            {/* Bar indicator */}
            <div className="flex gap-1 mb-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="h-[3px] flex-1 rounded-full"
                        initial={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                        animate={{
                            backgroundColor:
                                i < bars ? color : "rgba(255,255,255,0.1)",
                        }}
                        transition={{ duration: 0.2 }}
                    />
                ))}
            </div>

            {/* Label and feedback */}
            <div className="flex items-start gap-1.5">
                {level === "excellent" || level === "strong" ? (
                    <ShieldCheck
                        className="h-3.5 w-3.5 mt-0.5 shrink-0"
                        style={{ color }}
                    />
                ) : level === "weak" ? (
                    <ShieldAlert
                        className="h-3.5 w-3.5 mt-0.5 shrink-0"
                        style={{ color }}
                    />
                ) : (
                    <ShieldQuestion
                        className="h-3.5 w-3.5 mt-0.5 shrink-0"
                        style={{ color }}
                    />
                )}
                <div>
                    <span className="text-xs font-medium" style={{ color }}>
                        {levelLabels[level]}
                    </span>
                    {feedback.length > 0 &&
                        feedback[0] !== "Great password!" && (
                            <span className="text-xs text-[#ebe4f1]/50 ml-1">
                                — {feedback[0]}
                            </span>
                        )}
                </div>
            </div>
        </div>
    )
}

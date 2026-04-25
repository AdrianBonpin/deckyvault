"use client"

import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import OtpInput from "./otp-input"

interface OtpVerificationStepProps {
    email: string
    onSuccess: () => void
    onBack: () => void
}

export default function OtpVerificationStep({
    email,
    onSuccess,
    onBack,
}: OtpVerificationStepProps) {
    const [otp, setOtp] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [resendTimer, setResendTimer] = useState(300) // 5 minutes
    const [canResend, setCanResend] = useState(false)

    // Countdown timer
    useEffect(() => {
        if (resendTimer <= 0) {
            setCanResend(true)
            return
        }
        const interval = setInterval(() => {
            setResendTimer((prev) => prev - 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [resendTimer])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    const handleVerify = useCallback(async () => {
        if (otp.length !== 6) return

        setIsLoading(true)
        setError("")

        const { error } = await authClient.emailOtp.verifyEmail({
            email,
            otp,
        })

        setIsLoading(false)

        if (error) {
            setError(
                error.code === "TOO_MANY_ATTEMPTS"
                    ? "Too many attempts. Please request a new code."
                    : "Invalid code. Please try again.",
            )
            return
        }

        onSuccess()
    }, [otp, email, onSuccess])

    // Auto-submit when all digits entered
    useEffect(() => {
        if (otp.length === 6) {
            handleVerify()
        }
    }, [otp, handleVerify])

    const handleResend = async () => {
        setError("")
        await authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification",
        })
        setResendTimer(300)
        setCanResend(false)
    }

    return (
        <div className="space-y-4">
            <div className="text-center mb-2">
                <Mail className="h-10 w-10 text-[#eb3779] mx-auto mb-3" />
                <h1 className="text-lg font-bold text-[#ebe4f1]">
                    Verify your email
                </h1>
                <p className="text-xs text-[#ebe4f1]/50 mt-1">
                    We sent a 6-digit code to{" "}
                    <strong className="text-[#ebe4f1]">{email}</strong>
                </p>
            </div>

            <div>
                <label className="text-xs text-[#ebe4f1]/60 block mb-2 text-center">
                    Verification code
                </label>
                <OtpInput
                    value={otp}
                    onChange={setOtp}
                    disabled={isLoading}
                    error={error}
                />
            </div>

            <div className="text-center text-xs">
                {canResend ? (
                    <button
                        onClick={handleResend}
                        className="text-[#eb3779] hover:underline"
                    >
                        Resend code
                    </button>
                ) : (
                    <span className="text-[#ebe4f1]/40">
                        Resend code in{" "}
                        <span className="text-[#eb3779] font-semibold">
                            {formatTime(resendTimer)}
                        </span>
                    </span>
                )}
            </div>

            <button
                onClick={handleVerify}
                disabled={isLoading || otp.length !== 6}
                className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
            </button>

            <button
                onClick={onBack}
                className="flex items-center justify-center gap-1.5 w-full text-xs text-[#ebe4f1]/50 hover:text-[#ebe4f1] transition-colors"
            >
                <ArrowLeft className="h-3 w-3" />
                Back to signup
            </button>
        </div>
    )
}

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
    const canResend = resendTimer <= 0

    // Countdown timer
    useEffect(() => {
        if (resendTimer <= 0) return
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

    const handleVerify = useCallback(
        async (otpValue: string) => {
            if (otpValue.length !== 6) return

            setIsLoading(true)
            setError("")

            const { error } = await authClient.emailOtp.verifyEmail({
                email,
                otp: otpValue,
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
        },
        [email, onSuccess],
    )

    const handleResend = async () => {
        setError("")
        await authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification",
        })
        setResendTimer(300)
    }

    return (
        <div className="space-y-5">
            <div className="text-center mb-2">
                <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
                <h1 className="text-xl font-bold text-text">
                    Verify your email
                </h1>
                <p className="text-sm text-text/50 mt-2">
                    We sent a 6-digit code to{" "}
                    <strong className="text-text">{email}</strong>
                </p>
            </div>

            <div>
                <label className="text-sm text-text/60 block mb-2 text-center">
                    Verification code
                </label>
                <OtpInput
                    value={otp}
                    onChange={(value) => {
                        setOtp(value)
                        if (value.length === 6) {
                            handleVerify(value)
                        }
                    }}
                    disabled={isLoading}
                    error={error}
                />
            </div>

            <div className="text-center text-sm">
                {canResend ? (
                    <button
                        onClick={handleResend}
                        className="text-primary hover:underline"
                    >
                        Resend code
                    </button>
                ) : (
                    <span className="text-text/40">
                        Resend code in{" "}
                        <span className="text-primary font-semibold">
                            {formatTime(resendTimer)}
                        </span>
                    </span>
                )}
            </div>

            <button
                onClick={() => handleVerify(otp)}
                disabled={isLoading || otp.length !== 6}
                className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
            </button>

            <button
                onClick={onBack}
                className="flex items-center justify-center gap-2 w-full text-sm text-text/50 hover:text-text transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to signup
            </button>
        </div>
    )
}

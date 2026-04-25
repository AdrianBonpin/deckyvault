"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Mail,
    CheckCircle2,
    Loader2,
    ArrowLeft,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
    resetPasswordSchema,
    type ResetPasswordInput,
} from "@/lib/auth/validation"
import OtpInput from "./otp-input"
import PasswordStrengthMeter from "./password-strength"
import Link from "next/link"

interface ResetPasswordFormProps {
    email: string
}

export default function ResetPasswordForm({
    email,
}: ResetPasswordFormProps) {
    const [otp, setOtp] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [resendTimer, setResendTimer] = useState(300)
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        const result = resetPasswordSchema.safeParse({
            otp,
            newPassword,
            confirmPassword,
        })
        if (!result.success) {
            setError(result.error.issues[0].message)
            return
        }

        setIsLoading(true)
        const { error } = await authClient.resetPassword({
            newPassword,
            otp,
        })
        setIsLoading(false)

        if (error) {
            setError(
                error.code === "TOO_MANY_ATTEMPTS"
                    ? "Too many attempts. Please request a new code."
                    : error.message || "Failed to reset password.",
            )
            return
        }

        setIsSuccess(true)
    }

    const handleResend = async () => {
        setError("")
        await authClient.emailOtp.requestPasswordReset({ email })
        setResendTimer(300)
        setCanResend(false)
    }

    if (isSuccess) {
        return (
            <div className="text-center space-y-4">
                <CheckCircle2 className="h-10 w-10 text-[#22c55e] mx-auto" />
                <h1 className="text-lg font-bold text-[#ebe4f1]">
                    Password reset successful
                </h1>
                <p className="text-xs text-[#ebe4f1]/50">
                    Your password has been updated. You can now sign in with
                    your new password.
                </p>
                <Link
                    href="/login"
                    className="inline-block w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors text-center"
                >
                    Sign in
                </Link>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-2">
                <Mail className="h-10 w-10 text-[#eb3779] mx-auto mb-3" />
                <h1 className="text-lg font-bold text-[#ebe4f1]">
                    Check your email
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
                />
            </div>

            <div className="text-center text-xs">
                {canResend ? (
                    <button
                        type="button"
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

            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-[11px] text-[#ebe4f1]/40">
                    then set new password
                </span>
                <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {error && (
                <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            <div>
                <label className="text-xs text-[#ebe4f1]/60 block mb-1">
                    New password
                </label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 10 characters"
                    className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[#ebe4f1] text-sm placeholder:text-[#ebe4f1]/40 outline-none focus:border-[#eb3779] focus:ring-2 focus:ring-[#eb3779]/50 transition-colors"
                />
                <PasswordStrengthMeter password={newPassword} />
            </div>

            <div>
                <label className="text-xs text-[#ebe4f1]/60 block mb-1">
                    Confirm new password
                </label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[#ebe4f1] text-sm placeholder:text-[#ebe4f1]/40 outline-none focus:border-[#eb3779] focus:ring-2 focus:ring-[#eb3779]/50 transition-colors"
                />
                {confirmPassword &&
                    newPassword !== confirmPassword && (
                        <p className="text-red-400 text-xs mt-1">
                            Passwords do not match
                        </p>
                    )}
            </div>

            <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Reset password
            </button>

            <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-xs text-[#ebe4f1]/50 hover:text-[#ebe4f1] transition-colors"
            >
                <ArrowLeft className="h-3 w-3" />
                Back to sign in
            </Link>
        </form>
    )
}

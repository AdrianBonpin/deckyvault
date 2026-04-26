"use client"

import { useState, useEffect } from "react"
import {
    Mail,
    CheckCircle2,
    Loader2,
    ArrowLeft,
} from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
    resetPasswordSchema,
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
        const { error } = await authClient.emailOtp.resetPassword({
            email,
            otp,
            password: newPassword,
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
    }

    if (isSuccess) {
        return (
            <div className="text-center space-y-5">
                <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto" />
                <h1 className="text-xl font-bold text-text">
                    Password reset successful
                </h1>
                <p className="text-sm text-text/50">
                    Your password has been updated. You can now sign in with
                    your new password.
                </p>
                <Link
                    href="/login"
                    className="inline-block w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors text-center cursor-pointer"
                >
                    Sign in
                </Link>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-2">
                <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
                <h1 className="text-xl font-bold text-text">
                    Check your email
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
                    onChange={setOtp}
                    disabled={isLoading}
                />
            </div>

            <div className="text-center text-sm">
                {canResend ? (
                    <button
                        type="button"
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

            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text/40">
                    then set new password
                </span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            <div>
                <label className="text-sm text-text/60 block mb-1.5">
                    New password
                </label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 10 characters"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                />
                <PasswordStrengthMeter password={newPassword} />
            </div>

            <div>
                <label className="text-sm text-text/60 block mb-1.5">
                    Confirm new password
                </label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                />
                {confirmPassword &&
                    newPassword !== confirmPassword && (
                        <p className="text-red-400 text-sm mt-1">
                            Passwords do not match
                        </p>
                    )}
            </div>

            <button
                type="submit"
                disabled={isLoading || otp.length !== 6}
                className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Reset password
            </button>

            <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-sm text-text/50 hover:text-text transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
            </Link>
        </form>
    )
}

"use client"

import { useState } from "react"
import { Lock, Loader2, ArrowLeft } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
    forgotPasswordSchema,
} from "@/lib/auth/validation"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ForgotPasswordForm() {
    const router = useRouter()
    const [email, setEmail] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        const result = forgotPasswordSchema.safeParse({ email })
        if (!result.success) {
            setError(result.error.issues[0].message)
            return
        }

        setIsLoading(true)
        const { error } = await authClient.emailOtp.requestPasswordReset({
            email,
        })
        setIsLoading(false)

        if (error) {
            setError(
                error.message || "Something went wrong. Please try again.",
            )
            return
        }

        // Redirect to reset password page with email
        router.push(`/reset-password?email=${encodeURIComponent(email)}`)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-2">
                <Lock className="h-10 w-10 text-[#eb3779] mx-auto mb-3" />
                <h1 className="text-lg font-bold text-[#ebe4f1]">
                    Forgot your password?
                </h1>
                <p className="text-xs text-[#ebe4f1]/50 mt-1 leading-relaxed">
                    Enter your email and we&apos;ll send you a verification code to
                    reset your password.
                </p>
            </div>

            {error && (
                <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            <div>
                <label className="text-xs text-[#ebe4f1]/60 block mb-1">
                    Email
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[#ebe4f1] text-sm placeholder:text-[#ebe4f1]/40 outline-none focus:border-[#eb3779] focus:ring-2 focus:ring-[#eb3779]/50 transition-colors"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send verification code
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

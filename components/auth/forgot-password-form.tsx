"use client"

import { useState } from "react"
import { KeyRound, Loader2, ArrowLeft } from "lucide-react"
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
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-center mb-2">
                <KeyRound className="h-10 w-10 text-primary mx-auto mb-3" />
                <h1 className="text-xl font-bold text-text">
                    Forgot your password?
                </h1>
                <p className="text-sm text-text/50 mt-2 leading-relaxed">
                    Enter your email and we&apos;ll send you a verification code to
                    reset your password.
                </p>
            </div>

            {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            <div>
                <label className="text-sm text-text/60 block mb-1.5">
                    Email
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send verification code
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

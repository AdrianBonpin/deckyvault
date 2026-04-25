"use client"

import { useState, useEffect, useCallback } from "react"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
    loginEmailSchema,
    loginSchema,
    type LoginInput,
} from "@/lib/auth/validation"
import SocialButtons from "./social-buttons"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function LoginForm() {
    const router = useRouter()
    const [phase, setPhase] = useState<"email" | "password">("email")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    // Preload passkeys for conditional UI
    useEffect(() => {
        if (phase === "password" && "PublicKeyCredential" in window) {
            authClient.signIn.passkey({ autoFill: true })
        }
    }, [phase])

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        const result = loginEmailSchema.safeParse({ email })
        if (!result.success) {
            setError(result.error.issues[0].message)
            return
        }

        // Check if email exists by attempting sign-in with empty password
        setIsLoading(true)
        const { error } = await authClient.signIn.email(
            { email, password: "" },
            {
                onError: () => {
                    // Silently handle - we check the error type below
                },
            },
        )
        setIsLoading(false)

        if (error) {
            // If error is about invalid credentials, email exists but password is wrong
            // If error is about user not found, email doesn't exist
            if (
                error.message?.toLowerCase().includes("not found") ||
                error.message?.toLowerCase().includes("invalid email") ||
                error.status === 404
            ) {
                setError(
                    "No account found with this email.",
                )
                return
            }
            // Email exists, move to password phase
            setPhase("password")
            return
        }

        // Shouldn't reach here with empty password, but handle it
        setPhase("password")
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        const result = loginSchema.safeParse({ email, password })
        if (!result.success) {
            setError(result.error.issues[0].message)
            return
        }

        setIsLoading(true)
        const { error } = await authClient.signIn.email({ email, password })
        setIsLoading(false)

        if (error) {
            setError(error.message || "Invalid credentials. Please try again.")
            return
        }

        router.push("/")
    }

    const handleChangeEmail = () => {
        setPhase("email")
        setPassword("")
        setError("")
    }

    return (
        <div className="space-y-4">
            <div className="text-center mb-2">
                <h1 className="text-lg font-bold text-[#ebe4f1]">
                    Welcome back
                </h1>
                <p className="text-xs text-[#ebe4f1]/50 mt-1">
                    {phase === "email"
                        ? "Sign in to DeckyVault"
                        : `Signing in as `}
                    {phase === "password" && (
                        <>
                            <strong className="text-[#ebe4f1]">{email}</strong>
                            {" "}
                            <button
                                onClick={handleChangeEmail}
                                className="text-[#eb3779] hover:underline text-[11px]"
                            >
                                change
                            </button>
                        </>
                    )}
                </p>
            </div>

            <SocialButtons />

            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-[11px] text-[#ebe4f1]/40 uppercase">
                    or continue with email
                </span>
                <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {error && (
                <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                    {error.includes("No account found") && (
                        <>
                            {" "}
                            <Link
                                href="/signup"
                                className="text-[#eb3779] font-semibold hover:underline"
                            >
                                Create one →
                            </Link>
                        </>
                    )}
                </div>
            )}

            {phase === "email" ? (
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs text-[#ebe4f1]/60 block mb-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="username webauthn"
                            className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[#ebe4f1] text-sm placeholder:text-[#ebe4f1]/40 outline-none focus:border-[#eb3779] focus:ring-2 focus:ring-[#eb3779]/50 transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Continue
                    </button>
                </form>
            ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="text-xs text-[#ebe4f1]/60 block mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password webauthn"
                            autoFocus
                            className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[#ebe4f1] text-sm placeholder:text-[#ebe4f1]/40 outline-none focus:border-[#eb3779] focus:ring-2 focus:ring-[#eb3779]/50 transition-colors"
                        />
                    </div>
                    <div className="text-right">
                        <Link
                            href="/forgot-password"
                            className="text-xs text-[#ebe4f1]/50 hover:text-[#ebe4f1] transition-colors"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Sign in
                    </button>
                    {/* Passkey hint */}
                    <div className="text-center p-2.5 rounded-lg bg-[#eb3779]/5 border border-[#eb3779]/10">
                        <p className="text-xs text-[#ebe4f1]/50">
                            Your browser may offer to sign in with a passkey
                        </p>
                    </div>
                </form>
            )}

            <p className="text-center text-xs text-[#ebe4f1]/50">
                Don't have an account?{" "}
                <Link
                    href="/signup"
                    className="text-[#eb3779] hover:underline"
                >
                    Create one
                </Link>
            </p>
        </div>
    )
}

"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
    loginEmailSchema,
    loginSchema,
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

        setIsLoading(true)
        try {
            const res = await fetch("/api/auth/check-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })

            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Something went wrong. Please try again.")
                return
            }

            const data = await res.json()
            if (!data.exists) {
                setError("No account found with this email.")
                return
            }

            // Email exists, move to password phase
            setPhase("password")
        } catch {
            setError("Something went wrong. Please try again.")
        } finally {
            setIsLoading(false)
        }
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
        <div className="space-y-5">
            <div className="text-center mb-2">
                <h1 className="text-xl font-bold text-text">
                    Welcome back
                </h1>
                <p className="text-sm text-text/50 mt-1">
                    {phase === "email"
                        ? "Sign in to DeckyVault"
                        : `Signing in as `}
                    {phase === "password" && (
                        <>
                            <strong className="text-text">{email}</strong>
                            {" "}
                            <button
                                onClick={handleChangeEmail}
                                className="text-primary hover:underline text-xs"
                            >
                                change
                            </button>
                        </>
                    )}
                </p>
            </div>

            <SocialButtons />

            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text/40 uppercase">
                    or continue with email
                </span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {error}
                    {error.includes("No account found") && (
                        <>
                            {" "}
                            <Link
                                href="/signup"
                                className="text-primary font-semibold hover:underline"
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
                        <label className="text-sm text-text/60 block mb-1.5">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            autoComplete="username webauthn"
                            className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        <label className="text-sm text-text/60 block mb-1.5">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            autoComplete="current-password webauthn"
                            autoFocus
                            className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                        />
                    </div>
                    <div className="text-right">
                        <Link
                            href="/forgot-password"
                            className="text-sm text-text/50 hover:text-text transition-colors cursor-pointer"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Sign in
                    </button>
                    {/* Passkey hint */}
                    <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-xs text-text/50">
                            Your browser may offer to sign in with a passkey
                        </p>
                    </div>
                </form>
            )}

            <p className="text-center text-sm text-text/50">
                Don&apos;t have an account?{" "}
                <Link
                    href="/signup"
                    className="text-primary hover:underline cursor-pointer"
                >
                    Create one
                </Link>
            </p>
        </div>
    )
}

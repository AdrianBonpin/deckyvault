"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Loader2, Key } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import {
    loginEmailSchema,
    loginSchema,
} from "@/lib/auth/validation"
import SocialButtons from "./social-buttons"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

function isWebAuthnAbortError(err: unknown): boolean {
    if (err instanceof DOMException && err.name === "AbortError") return true
    const msg = err instanceof Error ? err.message : String(err ?? "")
    return msg.includes("abort signal") || msg.includes("AbortError")
}

// Suppress the console.error that @better-auth/passkey logs internally
// when a WebAuthn ceremony is aborted (expected on navigation/remount).
let suppressPasskeyErrors = false
const originalConsoleError = console.error
const passkeyErrorPattern = /\[Better Auth\] Error verifying passkey/

console.error = (...args: unknown[]) => {
    if (suppressPasskeyErrors) {
        const msg = typeof args[0] === 'string' ? args[0] : ''
        if (passkeyErrorPattern.test(msg) || args.some(a => isWebAuthnAbortError(a))) {
            return
        }
    }
    originalConsoleError(...args)
}

export default function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectTo = searchParams.get("redirect") || "/"
    const [showPassword, setShowPassword] = useState(false)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [emailChecked, setEmailChecked] = useState(false)
    const mountedRef = useRef(true)
    const passkeyInitiatedRef = useRef(false)

    // Redirect to the intended page after successful login
    const handleLoginSuccess = useCallback(() => {
        if (mountedRef.current) router.push(redirectTo)
    }, [router, redirectTo])

    // Preload passkeys for conditional UI — must be called on mount when
    // both email + password fields are in the DOM.
    useEffect(() => {
        mountedRef.current = true
        if ("PublicKeyCredential" in window && !passkeyInitiatedRef.current) {
            passkeyInitiatedRef.current = true
            suppressPasskeyErrors = true
            authClient.signIn.passkey({
                autoFill: true,
                fetchOptions: {
                    onSuccess: handleLoginSuccess,
                },
            }).catch((err) => {
                if (!isWebAuthnAbortError(err)) {
                    console.warn("[passkey-conditional-ui]", err)
                }
            }).finally(() => {
                suppressPasskeyErrors = false
            })
        }
        return () => { mountedRef.current = false }
    }, [handleLoginSuccess])

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

            // Email exists, show password field
            setEmailChecked(true)
            setShowPassword(true)
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

        router.push(redirectTo)
    }

    const handleChangeEmail = () => {
        setShowPassword(false)
        setPassword("")
        setError("")
        setEmailChecked(false)
    }

    const handlePasskeyError = useCallback((ctx: { error?: { message?: string } }) => {
        // Only show errors that aren't from conditional UI cancellation
        // (user dismissing the browser prompt is expected and not an error)
        const msg = ctx.error?.message || ""
        if (
            !msg.includes("No available") &&
            !msg.includes("cancelled") &&
            !msg.includes("NotAllowed") &&
            !msg.includes("aborted")
        ) {
            setError(msg || "Passkey sign-in failed. Please try again.")
        }
    }, [])

    const handlePasskeyLogin = async () => {
        setError("")
        setIsLoading(true)
        suppressPasskeyErrors = true
        try {
            const result = await authClient.signIn.passkey({
                autoFill: false,
                fetchOptions: {
                    onSuccess: handleLoginSuccess,
                    onError: handlePasskeyError,
                },
            }).catch((err) => {
                if (isWebAuthnAbortError(err)) return { data: null, error: null }
                return { data: null, error: { message: err?.message || "Passkey sign-in failed" } }
            })
            if (result?.error) {
                handlePasskeyError({ error: result.error })
            }
        } catch {
            setError("Passkey sign-in failed. Please try again.")
        } finally {
            suppressPasskeyErrors = false
            setIsLoading(false)
        }
    }

    return (
        <div className="space-y-5">
            <div className="text-center mb-2">
                <h1 className="text-xl font-bold text-text">
                    Welcome back
                </h1>
                <p className="text-sm text-text/50 mt-1">
                    {showPassword
                        ? "Signing in as "
                        : "Sign in to DeckyVault"}
                    {showPassword && (
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

            {/* Single form always contains both email and password inputs
                so that WebAuthn conditional UI (autofill) works correctly.
                The password field is visually hidden until the email is verified. */}
            <form onSubmit={showPassword ? handleLogin : handleEmailSubmit} className="space-y-4">
                <div>
                    <label className="text-sm text-text/60 block mb-1.5">
                        Email
                    </label>
                    <input
                        type="email"
                        name="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="username webauthn"
                        className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                    />
                </div>
                {/* Always render the password input for WebAuthn conditional UI,
                    but visually hide it until the email is verified */}
                <div className={showPassword ? "" : "h-0 overflow-hidden opacity-0 pointer-events-none"}>
                    <label className="text-sm text-text/60 block mb-1.5">
                        Password
                    </label>
                    <input
                        type="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        autoComplete="current-password webauthn"
                        autoFocus={showPassword}
                        tabIndex={showPassword ? 0 : -1}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                    />
                </div>
                {showPassword && (
                    <div className="text-right">
                        <Link
                            href="/forgot-password"
                            className="text-sm text-text/50 hover:text-text transition-colors cursor-pointer"
                        >
                            Forgot password?
                        </Link>
                    </div>
                )}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isLoading && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {showPassword ? "Sign in" : "Continue"}
                </button>
                {showPassword && (
                    <div className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <p className="text-xs text-text/50">
                            Your browser may offer to sign in with a passkey
                        </p>
                    </div>
                )}
            </form>

            {/* Explicit passkey login button */}
            {"PublicKeyCredential" in window && !showPassword && (
                <button
                    onClick={handlePasskeyLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-border bg-text/5 text-text/70 text-sm font-medium hover:bg-text/10 hover:text-text transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Key className="h-4 w-4" />
                    )}
                    Sign in with a passkey
                </button>
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

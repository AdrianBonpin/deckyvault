"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { signupSchema } from "@/lib/auth/validation"
import SocialButtons from "./social-buttons"
import PasswordStrengthMeter from "./password-strength"
import Link from "next/link"

interface SignupFormStepProps {
    onSuccess: (email: string) => void
}

export default function SignupFormStep({ onSuccess }: SignupFormStepProps) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [serverError, setServerError] = useState("")
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrors({})
        setServerError("")

        const result = signupSchema.safeParse({ name, email, password })
        if (!result.success) {
            const fieldErrors: Record<string, string> = {}
            result.error.issues.forEach((issue) => {
                const field = issue.path[0] as string
                fieldErrors[field] = issue.message
            })
            setErrors(fieldErrors)
            return
        }

        setIsLoading(true)
        const { error } = await authClient.signUp.email({
            name,
            email,
            password,
        })
        setIsLoading(false)

        if (error) {
            setServerError(
                error.message || "Something went wrong. Please try again.",
            )
            return
        }

        onSuccess(email)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-center mb-2">
                <h1 className="text-xl font-bold text-text">
                    Create your account
                </h1>
                <p className="text-sm text-text/50 mt-1">
                    Join DeckyVault and start exploring
                </p>
            </div>

            <SocialButtons callbackURL="/signup?step=passkey" />

            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text/40 uppercase">
                    or use email
                </span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {serverError && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {serverError}
                </div>
            )}

            <div>
                <label className="text-sm text-text/60 block mb-1.5">
                    Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                />
                {errors.name && (
                    <p className="text-red-400 text-sm mt-1">{errors.name}</p>
                )}
            </div>

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
                {errors.email && (
                    <p className="text-red-400 text-sm mt-1">{errors.email}</p>
                )}
            </div>

            <div>
                <label className="text-sm text-text/60 block mb-1.5">
                    Password
                </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 10 characters"
                    className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                />
                {errors.password && (
                    <p className="text-red-400 text-sm mt-1">
                        {errors.password}
                    </p>
                )}
                <PasswordStrengthMeter password={password} />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
            </button>

            <p className="text-center text-sm text-text/50">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline cursor-pointer">
                    Sign in
                </Link>
            </p>
        </form>
    )
}

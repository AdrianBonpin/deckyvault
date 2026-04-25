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
                <h1 className="text-lg font-bold text-[#ebe4f1]">
                    Create your account
                </h1>
                <p className="text-xs text-[#ebe4f1]/50 mt-1">
                    Choose how you&apos;d like to sign up
                </p>
            </div>

            <SocialButtons callbackURL="/signup?step=passkey" />

            <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-[11px] text-[#ebe4f1]/40 uppercase">
                    or use email
                </span>
                <div className="flex-1 h-px bg-white/[0.08]" />
            </div>

            {serverError && (
                <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {serverError}
                </div>
            )}

            <div>
                <label className="text-xs text-[#ebe4f1]/60 block mb-1">
                    Name
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[#ebe4f1] text-sm placeholder:text-[#ebe4f1]/40 outline-none focus:border-[#eb3779] focus:ring-2 focus:ring-[#eb3779]/50 transition-colors"
                />
                {errors.name && (
                    <p className="text-red-400 text-xs mt-1">{errors.name}</p>
                )}
            </div>

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
                {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                )}
            </div>

            <div>
                <label className="text-xs text-[#ebe4f1]/60 block mb-1">
                    Password
                </label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 10 characters"
                    className="w-full px-3 py-2.5 rounded-lg border border-white/10 bg-white/[0.03] text-[#ebe4f1] text-sm placeholder:text-[#ebe4f1]/40 outline-none focus:border-[#eb3779] focus:ring-2 focus:ring-[#eb3779]/50 transition-colors"
                />
                {errors.password && (
                    <p className="text-red-400 text-xs mt-1">
                        {errors.password}
                    </p>
                )}
                <PasswordStrengthMeter password={password} />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
            </button>

            <p className="text-center text-xs text-[#ebe4f1]/50">
                Already have an account?{" "}
                <Link href="/login" className="text-[#eb3779] hover:underline">
                    Sign in
                </Link>
            </p>
        </form>
    )
}

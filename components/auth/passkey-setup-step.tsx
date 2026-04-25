"use client"

import { useState } from "react"
import { KeyRound, Check, Loader2, Fingerprint } from "lucide-react"
import { authClient } from "@/lib/auth-client"

interface PasskeySetupStepProps {
    onSuccess: () => void
    onSkip: () => void
}

export default function PasskeySetupStep({
    onSuccess,
    onSkip,
}: PasskeySetupStepProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState("")

    const isPasskeySupported =
        typeof window !== "undefined" &&
        "PublicKeyCredential" in window

    const handleAddPasskey = async () => {
        setIsLoading(true)
        setError("")

        const { error } = await authClient.passkey.addPasskey({
            name: "Primary passkey",
        })

        setIsLoading(false)

        if (error) {
            setError(
                error.message ||
                    "Failed to set up passkey. You can try again later.",
            )
            return
        }

        onSuccess()
    }

    return (
        <div className="space-y-4">
            <div className="text-center mb-2">
                <KeyRound className="h-10 w-10 text-[#eb3779] mx-auto mb-3" />
                <h1 className="text-lg font-bold text-[#ebe4f1]">
                    Set up a passkey
                </h1>
                <p className="text-xs text-[#ebe4f1]/50 mt-1 leading-relaxed">
                    Sign in faster with biometrics or your device's security
                    key. No password needed.
                </p>
            </div>

            {/* Benefits list */}
            <div className="bg-white/[0.02] rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#ebe4f1]/60">
                    <Check className="h-3.5 w-3.5 text-[#22c55e] shrink-0" />
                    Faster sign-in with fingerprint or face
                </div>
                <div className="flex items-center gap-2 text-xs text-[#ebe4f1]/60">
                    <Check className="h-3.5 w-3.5 text-[#22c55e] shrink-0" />
                    More secure than passwords
                </div>
                <div className="flex items-center gap-2 text-xs text-[#ebe4f1]/60">
                    <Check className="h-3.5 w-3.5 text-[#22c55e] shrink-0" />
                    Works across your devices
                </div>
            </div>

            {error && (
                <div className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                </div>
            )}

            {isPasskeySupported ? (
                <>
                    <button
                        onClick={handleAddPasskey}
                        disabled={isLoading}
                        className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Fingerprint className="h-4 w-4" />
                        )}
                        Set up passkey
                    </button>
                    <button
                        onClick={onSkip}
                        className="w-full py-2.5 rounded-lg border border-white/10 text-[#ebe4f1]/60 text-sm hover:bg-white/[0.03] transition-colors"
                    >
                        Skip for now
                    </button>
                </>
            ) : (
                <div className="text-center">
                    <p className="text-xs text-[#ebe4f1]/40 mb-3">
                        Passkeys are not supported on this device.
                    </p>
                    <button
                        onClick={onSkip}
                        className="w-full py-2.5 rounded-lg bg-[#eb3779] text-white text-sm font-semibold hover:bg-[#eb3779]/90 transition-colors"
                    >
                        Continue
                    </button>
                </div>
            )}
        </div>
    )
}

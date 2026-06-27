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
        <div className="space-y-5">
            <div className="text-center mb-2">
                <KeyRound className="h-10 w-10 text-primary mx-auto mb-3" />
                <h1 className="text-xl font-bold text-text">
                    Set up a passkey
                </h1>
                <p className="text-sm text-text/50 mt-2 leading-relaxed">
                    Sign in faster with biometrics or your device&apos;s security
                    key. No password needed.
                </p>
            </div>

            {/* Benefits list */}
            <div className="bg-text/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm text-text/60">
                    <Check className="h-4 w-4 text-green-400 shrink-0" />
                    Faster sign-in with fingerprint or face
                </div>
                <div className="flex items-center gap-3 text-sm text-text/60">
                    <Check className="h-4 w-4 text-green-400 shrink-0" />
                    More secure than passwords
                </div>
                <div className="flex items-center gap-3 text-sm text-text/60">
                    <Check className="h-4 w-4 text-green-400 shrink-0" />
                    Works across your devices
                </div>
            </div>

            {error && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            {isPasskeySupported ? (
                <>
                    <button
                        onClick={handleAddPasskey}
                        disabled={isLoading}
                        className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        className="w-full py-3 rounded-lg border border-border text-text/60 text-sm hover:bg-text/5 transition-colors cursor-pointer"
                    >
                        Skip for now
                    </button>
                </>
            ) : (
                <div className="text-center">
                    <p className="text-sm text-text/40 mb-4">
                        Passkeys are not supported on this device.
                    </p>
                    <button
                        onClick={onSkip}
                        className="w-full py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                    >
                        Continue
                    </button>
                </div>
            )}
        </div>
    )
}

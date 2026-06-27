"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { authClient } from "@/lib/auth-client"

interface SocialButtonsProps {
    callbackURL?: string
    disabled?: boolean
}

export default function SocialButtons({
    callbackURL = "/",
    disabled = false,
}: SocialButtonsProps) {
    const [loadingProvider, setLoadingProvider] = useState<
        "google" | "discord" | null
    >(null)

    const handleSocialLogin = async (provider: "google" | "discord") => {
        setLoadingProvider(provider)
        await authClient.signIn.social(
            {
                provider,
                callbackURL,
            },
            {
                onError: () => {
                    setLoadingProvider(null)
                },
            },
        )
    }

    const isLoading = loadingProvider !== null

    return (
        <div className="flex gap-3">
            <button
                type="button"
                onClick={() => handleSocialLogin("google")}
                disabled={disabled || isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm font-medium hover:bg-text/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loadingProvider === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                )}
                Google
            </button>

            <button
                type="button"
                onClick={() => handleSocialLogin("discord")}
                disabled={disabled || isLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm font-medium hover:bg-text/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loadingProvider === "discord" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#5865F2">
                        <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 00-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 00-4.8 0c-.14-.34-.35-.76-.54-1.09-.01-.01-.04-.03-.07-.03-1.5.26-2.93.71-4.27 1.33-.01 0-.02.01-.03.02-2.72 4.07-3.47 8.03-3.1 11.95 0 .01.01.03.02.04 1.69 1.24 3.33 1.99 4.95 2.49.03.01.06 0 .07-.02.38-.52.72-1.07 1.01-1.65.02-.04 0-.08-.04-.09-.55-.2-1.08-.45-1.59-.73-.04-.02-.04-.08 0-.1.11-.08.22-.17.33-.26.02-.02.05-.02.07-.01 3.44 1.57 7.15 1.57 10.55 0 .02-.01.05-.01.07.01.11.09.22.17.33.26.04.02.04.08 0 .1-.51.28-1.04.53-1.59.73-.04.01-.05.06-.04.09.29.58.64 1.13 1.01 1.65.03.01.06.02.09.01 1.62-.5 3.27-1.25 4.96-2.49.01-.01.02-.03.02-.04.44-4.53-.73-8.46-3.1-11.95-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12 0 1.17-.83 2.12-1.89 2.12z" />
                    </svg>
                )}
                Discord
            </button>
        </div>
    )
}

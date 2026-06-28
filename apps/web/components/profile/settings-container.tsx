"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { User, Shield, Link as LinkIcon, Key } from "lucide-react"
import { SettingsProfileTab } from "@/components/profile/settings-profile-tab"
import { SettingsSecurityTab } from "@/components/profile/settings-security-tab"
import { SettingsAccountsTab } from "@/components/profile/settings-accounts-tab"
import { SettingsApiKeysTab } from "@/components/profile/settings-api-keys-tab"

interface AuthMethods {
    hasPassword: boolean
    passkeyCount: number
    oauthProviders: Array<{ providerId: string; id: string }>
    totalAuthMethods: number
}

type SettingsSubTab = "profile" | "security" | "accounts" | "api-keys"

const VALID_SUBTABS: SettingsSubTab[] = ["profile", "security", "accounts", "api-keys"]

const subTabs: { id: SettingsSubTab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "accounts", label: "Linked Accounts", icon: LinkIcon },
    { id: "api-keys", label: "API Keys", icon: Key },
]

interface SettingsContainerProps {
    name: string
    email: string
    role: string | null
    createdAt: string
    image?: string | null
    userId: string
    onImageChange?: (url: string | null) => void
}

export function SettingsContainer({
    name,
    email,
    role,
    createdAt,
    image,
    userId,
    onImageChange,
}: SettingsContainerProps) {
    const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(() => {
        if (typeof window === "undefined") return "profile"
        const params = new URLSearchParams(window.location.search)
        const sub = params.get("subtab")
        return sub && VALID_SUBTABS.includes(sub as SettingsSubTab) ? (sub as SettingsSubTab) : "profile"
    })
    const [authMethods, setAuthMethods] = useState<AuthMethods | null>(null)
    const [isLoadingAuthMethods, setIsLoadingAuthMethods] = useState(true)

    useEffect(() => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)

        fetch("/api/user/me/auth-methods", {
            credentials: "include",
            signal: controller.signal,
        })
            .then(async (r) => {
                if (r.ok) {
                    return r.json()
                }
                // Log non-OK responses for debugging
                console.warn(`[auth-methods] fetch returned ${r.status}`)
                return null
            })
            .then((data) => {
                if (data) setAuthMethods(data)
                setIsLoadingAuthMethods(false)
            })
            .catch((err) => {
                if (err.name !== "AbortError") {
                    console.error("[auth-methods] fetch failed:", err)
                }
                setIsLoadingAuthMethods(false)
            })
            .finally(() => clearTimeout(timeoutId))

        return () => {
            controller.abort()
            clearTimeout(timeoutId)
        }
    }, [])

    const refreshAuthMethods = async () => {
        setIsLoadingAuthMethods(true)
        try {
            const res = await fetch("/api/user/me/auth-methods", {
                credentials: "include",
            })
            if (res.ok) {
                setAuthMethods(await res.json())
            } else {
                setAuthMethods(null)
            }
        } catch {
            setAuthMethods(null)
        } finally {
            setIsLoadingAuthMethods(false)
        }
    }

    return (
        <div className='flex flex-col md:flex-row gap-6'>
            {/* Sidebar Navigation */}
            <nav className='md:w-48 shrink-0'>
                <div className='flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:border-r md:border-border'>
                    {subTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-lg md:rounded-none md:border-l-2 md:border-r-0 md:border-transparent cursor-pointer ${
                                activeSubTab === tab.id
                                    ? "bg-primary/10 text-primary md:border-l-primary md:bg-primary/10"
                                    : "text-text/50 hover:text-text/70 hover:bg-text/5"
                            }`}
                        >
                            <tab.icon className='h-4 w-4 shrink-0' />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Content Area */}
            <div className='flex-1 min-w-0'>
                {activeSubTab === "profile" && (
                    <SettingsProfileTab
                        name={name}
                        email={email}
                        role={role}
                        createdAt={createdAt}
                        image={image}
                        userId={userId}
                        onImageChange={onImageChange}
                    />
                )}
                {activeSubTab === "security" && (
                    <SettingsSecurityTab
                        authMethods={authMethods}
                        isLoadingAuthMethods={isLoadingAuthMethods}
                        onRefreshAuthMethods={refreshAuthMethods}
                    />
                )}
                {activeSubTab === "accounts" && (
                    <SettingsAccountsTab
                        authMethods={authMethods}
                        isLoadingAuthMethods={isLoadingAuthMethods}
                        onRefreshAuthMethods={refreshAuthMethods}
                    />
                )}
                {activeSubTab === "api-keys" && (
                    <SettingsApiKeysTab />
                )}
            </div>
        </div>
    )
}

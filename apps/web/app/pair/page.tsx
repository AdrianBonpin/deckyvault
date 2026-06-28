"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "@/lib/auth-client"
import {
    QrCodeIcon,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Gamepad2,
    ShieldCheck,
    ArrowRight,
} from "lucide-react"
import { motion } from "motion/react"

function PairContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get("token")
    const { data: session, isPending } = useSession()

    const [status, setStatus] = useState<"idle" | "confirming" | "success" | "error">("idle")
    const [error, setError] = useState<string | null>(null)
    const [checkedToken, setCheckedToken] = useState(false)
    const [tokenValid, setTokenValid] = useState<boolean | null>(null)

    // Validate the token exists on the server before showing the confirm UI
    useEffect(() => {
        if (!token) {
            setCheckedToken(true)
            setTokenValid(false)
            return
        }
        let cancelled = false
        fetch(`/api/plugin/pair/status/${encodeURIComponent(token)}`)
            .then(async (res) => {
                if (cancelled) return
                const data = await res.json()
                if (data.status === "pending") {
                    setTokenValid(true)
                } else if (data.status === "confirmed") {
                    setTokenValid(false)
                    setError("This pairing link has already been used.")
                } else {
                    setTokenValid(false)
                    setError(data.error || "This pairing link is invalid or expired.")
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTokenValid(false)
                    setError("Could not verify pairing link.")
                }
            })
            .finally(() => {
                if (!cancelled) setCheckedToken(true)
            })
        return () => {
            cancelled = true
        }
    }, [token])

    async function handleConfirm() {
        if (!token) return
        setStatus("confirming")
        setError(null)
        try {
            const res = await fetch("/api/plugin/pair/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            })
            const data = await res.json()
            if (!res.ok) {
                setStatus("error")
                setError(data.error || "Failed to link plugin.")
                return
            }
            setStatus("success")
        } catch {
            setStatus("error")
            setError("Network error. Please try again.")
        }
    }

    // ── Loading ───────────────────────────────────────────────
    if (isPending || !checkedToken) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-text/40" />
            </div>
        )
    }

    // ── No token ──────────────────────────────────────────────
    if (!token || tokenValid === false) {
        return (
            <CenterCard>
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h1 className="text-xl font-bold text-text mb-2">
                    Invalid Pairing Link
                </h1>
                <p className="text-sm text-text/60 mb-6">
                    {error ||
                        "This link is missing a token or has expired. Start a new pairing session from the DeckyVault plugin on your Steam Deck."}
                </p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    Go Home
                </Link>
            </CenterCard>
        )
    }

    // ── Not logged in ─────────────────────────────────────────
    if (!session) {
        const callback = encodeURIComponent(`/pair?token=${token}`)
        return (
            <CenterCard>
                <Gamepad2 className="h-12 w-12 text-primary mx-auto mb-4" />
                <h1 className="text-xl font-bold text-text mb-2">
                    Log in to link your plugin
                </h1>
                <p className="text-sm text-text/60 mb-6">
                    You need to be logged in to DeckyVault so we can create an API
                    key for your account.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href={`/login?callbackUrl=${callback}`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        Log In
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                        href={`/signup?callbackUrl=${callback}`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-text text-sm font-medium hover:border-primary/40 transition-colors"
                    >
                        Create Account
                    </Link>
                </div>
            </CenterCard>
        )
    }

    // ── Success ───────────────────────────────────────────────
    if (status === "success") {
        return (
            <CenterCard>
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                    <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-4" />
                </motion.div>
                <h1 className="text-xl font-bold text-text mb-2">
                    Plugin Linked!
                </h1>
                <p className="text-sm text-text/60 mb-6">
                    Your DeckyVault plugin is now connected to{" "}
                    <span className="text-text font-medium">{session.user.name}</span>
                    &apos;s account. An API key named{" "}
                    <span className="font-mono text-primary">Decky Loader Plugin</span>{" "}
                    was created. You can close this page and return to your Steam Deck.
                </p>
                <Link
                    href="/profile/settings?tab=api-keys"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    Manage API Keys
                </Link>
            </CenterCard>
        )
    }

    // ── Confirm ───────────────────────────────────────────────
    return (
        <CenterCard>
            <div className="flex items-center justify-center gap-3 mb-6">
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 border border-primary/20">
                    <QrCodeIcon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-text/5 border border-border">
                    <Gamepad2 className="h-7 w-7 text-text/60" />
                </div>
            </div>

            <h1 className="text-xl font-bold text-text mb-2 text-center">
                Link DeckyVault Plugin
            </h1>
            <p className="text-sm text-text/60 mb-6 text-center max-w-md">
                Confirm to connect the DeckyVault plugin on your Steam Deck to your
                account. We&apos;ll create an API key so the plugin can upload
                performance entries on your behalf.
            </p>

            <div className="w-full rounded-xl border border-border bg-text/2 p-4 mb-6">
                <div className="flex items-center gap-3">
                    {session.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={session.user.image}
                            alt=""
                            className="w-10 h-10 rounded-full"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium">
                            {session.user.name?.[0]?.toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">
                            {session.user.name}
                        </p>
                        <p className="text-xs text-text/50 truncate">
                            {session.user.email}
                        </p>
                    </div>
                </div>
            </div>

            <div className="w-full flex items-start gap-2 text-xs text-text/50 mb-6">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-green-400" />
                <span>
                    An API key (<span className="font-mono">Decky Loader Plugin</span>)
                    will be created for your account. You can revoke it anytime from
                    Settings → API Keys.
                </span>
            </div>

            {error && (
                <div className="w-full text-sm text-red-400 flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            <button
                onClick={handleConfirm}
                disabled={status === "confirming"}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
                {status === "confirming" ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Linking…
                    </>
                ) : (
                    <>
                        <CheckCircle2 className="h-4 w-4" />
                        Confirm & Link Plugin
                    </>
                )}
            </button>
        </CenterCard>
    )
}

function CenterCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md flex flex-col items-center rounded-2xl border border-border bg-card p-8"
            >
                {children}
            </motion.div>
        </div>
    )
}

export default function PairPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-[60vh] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-text/40" />
                </div>
            }
        >
            <PairContent />
        </Suspense>
    )
}
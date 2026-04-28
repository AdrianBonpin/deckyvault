"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { useSession } from "@/lib/auth-client"
import type { GameSettingCategory } from "@/lib/db/schema/performanceEntries"
import {
    ThumbsUpIcon,
    ThumbsDownIcon,
    FlagIcon,
    TrashIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ShieldCheckIcon,
    XIcon,
    UserIcon,
    ShareIcon,
    PencilIcon,
} from "lucide-react"
import { TiptapRenderer } from "@/components/tiptap-renderer"

interface Preset {
    id: string
    gameId?: string
    hardwareSlug: string
    hardwareName: string
    upvotes: number
    downvotes: number
    settingsJson: GameSettingCategory[] | null
    settingsCount: number
    fpsAvg: number | null
    fpsLow: number | null
    fpsHigh: number | null
    fpsOnePercentLow: number | null
    upscalerType: string | null
    upscalerVersion: string | null
    frameGenMethod: string | null
    protonVersion: string | null
    osVersion: string | null
    launchOptions: string | null
    userNotes: string | null
    userId: string
    userName: string | null
    userImage: string | null
    verifiedAt: string | null
    isPinned: boolean
    pinnedAt: string | null
    createdAt: string
}

interface PresetDetailModalProps {
    preset: Preset
    gameId: string
    onClose: () => void
    onDelete: (presetId: string) => void
    onReport: (
        presetId: string,
        reason: "inaccurate" | "spam" | "inappropriate" | "other",
        details?: string,
    ) => void
    hasReported: boolean
}

function formatDate(value: string | null): string {
    if (!value) return "—"
    return new Date(value).toLocaleDateString()
}

function formatValue(value: string | number | boolean): string {
    if (typeof value === "boolean") return value ? "On" : "Off"
    return String(value)
}

export function PresetDetailModal({
    preset,
    gameId,
    onClose,
    onDelete,
    onReport,
    hasReported,
}: PresetDetailModalProps) {
    const router = useRouter()
    const { data: session } = useSession()

    const [activeCategoryIndex, setActiveCategoryIndex] = useState(0)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showReportForm, setShowReportForm] = useState(false)
    const [reportReason, setReportReason] = useState<
        "inaccurate" | "spam" | "inappropriate" | "other"
    >("inaccurate")
    const [reportDetails, setReportDetails] = useState("")
    const [copied, setCopied] = useState(false)

    const [userVote, setUserVote] = useState<"up" | "down" | null>(null)
    const [localUpvotes, setLocalUpvotes] = useState(preset.upvotes)
    const [localDownvotes, setLocalDownvotes] = useState(preset.downvotes)

    const isOwner = session?.user?.id === preset.userId
    const isAdmin = session?.user?.role === "admin"
    const isAuthenticated = !!session?.user

    const handleShare = () => {
        const url = `${window.location.origin}/game/${gameId}?preset=${preset.id}`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const categories = preset.settingsJson ?? []
    const hasCategories = categories.length > 0
    const currentCategory = hasCategories ? categories[activeCategoryIndex] : null

    const goPrevCategory = () => {
        setActiveCategoryIndex((prev) => (prev > 0 ? prev - 1 : categories.length - 1))
    }

    const goNextCategory = () => {
        setActiveCategoryIndex((prev) => (prev < categories.length - 1 ? prev + 1 : 0))
    }

    const handleUpvote = async () => {
        if (!isAuthenticated || userVote === "up") return
        try {
            const res = await fetch(`/api/performance/${preset.id}/upvote`, { method: "POST" })
            if (res.ok) {
                if (userVote === "down") setLocalDownvotes((d) => d - 1)
                setLocalUpvotes((u) => u + 1)
                setUserVote("up")
            }
        } catch (err) {
            console.error("Failed to upvote:", err)
        }
    }

    const handleDownvote = async () => {
        if (!isAuthenticated || userVote === "down") return
        try {
            const res = await fetch(`/api/performance/${preset.id}/downvote`, { method: "POST" })
            if (res.ok) {
                if (userVote === "up") setLocalUpvotes((u) => u - 1)
                setLocalDownvotes((d) => d + 1)
                setUserVote("down")
            }
        } catch (err) {
            console.error("Failed to downvote:", err)
        }
    }

    const handleReportSubmit = () => {
        onReport(
            preset.id,
            reportReason,
            reportDetails.trim() || undefined,
        )
        setShowReportForm(false)
        setReportDetails("")
    }

    const handleTogglePin = async () => {
        const method = preset.isPinned ? "DELETE" : "POST"
        try {
            const res = await fetch(`/api/performance/${preset.id}/pin`, { method })
            if (res.ok) {
                router.refresh()
            }
        } catch (err) {
            console.error("Failed to toggle pin:", err)
        }
    }

    return (
        <AnimatePresence>
            <>
                {/* Backdrop */}
                <motion.div
                    key="backdrop"
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                />

                {/* Modal container */}
                <motion.div
                    key="modal"
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    {/* Modal card */}
                    <motion.div
                        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-background flex flex-col"
                        initial={{ y: "100%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: "100%", opacity: 0 }}
                        transition={{
                            type: "spring",
                            damping: 30,
                            stiffness: 300,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <h2 className="text-base font-semibold text-text truncate">
                                    {preset.hardwareName}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer shrink-0"
                                aria-label="Close"
                            >
                                <XIcon className="h-4 w-4 text-text/50" />
                            </button>
                        </div>

                        {/* Two-column body */}
                        <div className="flex flex-col md:flex-row overflow-hidden flex-1">
                            {/* Left panel */}
                            <div className="w-full md:w-1/3 md:min-w-[240px] flex flex-col gap-3 md:gap-4 p-4 md:p-5 border-b md:border-b-0 md:border-r border-border overflow-y-auto">
                                {/* User info */}
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-text/10 overflow-hidden flex items-center justify-center shrink-0">
                                        {preset.userImage ? (
                                            <Image
                                                src={preset.userImage}
                                                alt={preset.userName || "User"}
                                                width={40}
                                                height={40}
                                                className="object-cover"
                                            />
                                        ) : (
                                            <UserIcon className="h-5 w-5 text-text/50" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-text truncate">
                                                {preset.userName || "Anonymous"}
                                            </span>
                                            {preset.verifiedAt && (
                                                <span
                                                    className="inline-flex items-center gap-0.5 text-green-400"
                                                    title="Verified"
                                                >
                                                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-text/50">
                                            {formatDate(preset.createdAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="h-px bg-border" />

                                {/* Vote buttons */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleUpvote}
                                        disabled={!isAuthenticated || userVote === "up"}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                            userVote === "up"
                                                ? "bg-green-500/10 border-green-500/30 text-green-400"
                                                : "border-border text-text/70 hover:bg-text/5"
                                        } ${!isAuthenticated ? "opacity-50 cursor-not-allowed" : ""}`}
                                        title={!isAuthenticated ? "Sign in to vote" : undefined}
                                    >
                                        <ThumbsUpIcon className="h-4 w-4" />
                                        {localUpvotes}
                                    </button>
                                    <button
                                        onClick={handleDownvote}
                                        disabled={!isAuthenticated || userVote === "down"}
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                            userVote === "down"
                                                ? "bg-red-500/10 border-red-500/30 text-red-400"
                                                : "border-border text-text/70 hover:bg-text/5"
                                        } ${!isAuthenticated ? "opacity-50 cursor-not-allowed" : ""}`}
                                        title={!isAuthenticated ? "Sign in to vote" : undefined}
                                    >
                                        <ThumbsDownIcon className="h-4 w-4" />
                                        {localDownvotes}
                                    </button>
                                </div>

                                {/* FPS */}
                                {preset.fpsAvg !== null && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs text-text/50 uppercase tracking-wider">
                                            Avg FPS
                                        </span>
                                        <div className="text-sm text-text">
                                            <span className="font-semibold tabular-nums">
                                                {preset.fpsAvg}
                                            </span>
                                            {preset.fpsLow !== null && preset.fpsHigh !== null && (
                                                <span className="text-text/50 ml-1">
                                                    ({Math.round(preset.fpsLow)}–{Math.round(preset.fpsHigh)})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {preset.fpsOnePercentLow !== null && (
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] text-text/50 uppercase tracking-wider">1% Low FPS</span>
                                        <span className="text-sm font-semibold tabular-nums text-text">
                                            {preset.fpsOnePercentLow} fps
                                        </span>
                                    </div>
                                )}

                                <div className="h-px bg-border" />

                                {/* Metadata */}
                                <div className="flex flex-col gap-3">
                                    <MetaItem label="Proton" value={preset.protonVersion} />
                                    <MetaItem label="OS" value={preset.osVersion} />
                                    <MetaItem
                                        label="Upscaler"
                                        value={
                                            preset.upscalerType && preset.upscalerType !== "none"
                                                ? `${preset.upscalerType.toUpperCase()}${preset.upscalerVersion ? ` ${preset.upscalerVersion}` : ""}`
                                                : null
                                        }
                                    />
                                    <MetaItem
                                        label="Frame Gen"
                                        value={
                                            preset.frameGenMethod && preset.frameGenMethod !== "none"
                                                ? preset.frameGenMethod === "fsr_fg"
                                                    ? "FSR FG"
                                                    : preset.frameGenMethod === "dlss_fg"
                                                      ? "DLSS FG"
                                                      : preset.frameGenMethod
                                                : null
                                        }
                                    />
                                    <MetaItem label="Launch Options" value={preset.launchOptions} />
                                </div>

                                <div className="h-px bg-border" />

                                {/* Actions */}
                                <div className="flex flex-wrap items-center gap-2 mt-auto">
                                    {isAdmin && (
                                        <button
                                            onClick={handleTogglePin}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-yellow-500/20 hover:bg-yellow-500/10 text-yellow-400 transition-colors cursor-pointer"
                                        >
                                            📌 {preset.isPinned ? 'Unpin' : 'Pin'}
                                        </button>
                                    )}
                                    {(isOwner || isAdmin) && (
                                        <>
                                            {!showDeleteConfirm ? (
                                                <button
                                                    onClick={() => setShowDeleteConfirm(true)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                    Delete
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-text/50">
                                                        Are you sure?
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            onDelete(preset.id)
                                                            setShowDeleteConfirm(false)
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors cursor-pointer"
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(false)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text/50 border border-border hover:bg-text/5 transition-colors cursor-pointer"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {(isOwner || isAdmin) && (
                                        <button
                                            onClick={() => router.push(`/game/${gameId}/submit?edit=${preset.id}`)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
                                        >
                                            <PencilIcon className="h-4 w-4" />
                                            Edit
                                        </button>
                                    )}

                                    <button
                                        onClick={handleShare}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
                                    >
                                        <ShareIcon className="h-4 w-4" />
                                        {copied ? "Link copied!" : "Share"}
                                    </button>

                                    {session && !hasReported && (
                                        <>
                                            {!showReportForm ? (
                                                <button
                                                    onClick={() => setShowReportForm(true)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text/50 border border-border hover:bg-text/5 transition-colors cursor-pointer"
                                                >
                                                    <FlagIcon className="h-4 w-4" />
                                                    Report
                                                </button>
                                            ) : (
                                                <div className="flex flex-col gap-2 w-full">
                                                    <select
                                                        value={reportReason}
                                                        onChange={(e) =>
                                                            setReportReason(
                                                                e.target.value as typeof reportReason,
                                                            )
                                                        }
                                                        className="text-sm bg-background border border-border rounded-md px-2 py-1.5 text-text/80 focus:outline-none focus:border-primary w-full max-w-xs"
                                                    >
                                                        <option value="inaccurate">
                                                            Inaccurate data
                                                        </option>
                                                        <option value="spam">
                                                            Spam
                                                        </option>
                                                        <option value="inappropriate">
                                                            Inappropriate
                                                        </option>
                                                        <option value="other">
                                                            Other
                                                        </option>
                                                    </select>
                                                    <textarea
                                                        value={reportDetails}
                                                        onChange={(e) =>
                                                            setReportDetails(e.target.value)
                                                        }
                                                        placeholder="Additional details (optional)"
                                                        rows={3}
                                                        className="text-sm bg-background border border-border rounded-md px-2 py-1.5 text-text/80 focus:outline-none focus:border-primary w-full resize-none"
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={handleReportSubmit}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
                                                        >
                                                            Submit Report
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowReportForm(false)
                                                                setReportDetails("")
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text/50 border border-border hover:bg-text/5 transition-colors cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {hasReported && (
                                        <span className="inline-flex items-center gap-1.5 text-sm text-text/50">
                                            <FlagIcon className="h-4 w-4" />
                                            Reported
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Right panel */}
                            <div className="flex-1 overflow-y-auto p-5">
                                {hasCategories ? (
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={currentCategory?.category ?? "empty"}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="flex flex-col gap-4"
                                        >
                                            {/* Category navigation */}
                                            <div className="flex items-center justify-between">
                                                <button
                                                    onClick={goPrevCategory}
                                                    className="p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer"
                                                    aria-label="Previous category"
                                                >
                                                    <ChevronLeftIcon className="h-4 w-4 text-text/50" />
                                                </button>
                                                <span className="text-sm font-medium text-text/80">
                                                    {currentCategory?.category}{" "}
                                                    <span className="text-text/40">
                                                        ({activeCategoryIndex + 1}/{categories.length})
                                                    </span>
                                                </span>
                                                <button
                                                    onClick={goNextCategory}
                                                    className="p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer"
                                                    aria-label="Next category"
                                                >
                                                    <ChevronRightIcon className="h-4 w-4 text-text/50" />
                                                </button>
                                            </div>

                                            {/* Settings table */}
                                            <div className="rounded-lg border border-border overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-text/3">
                                                        <tr>
                                                            <th className="text-left px-2 py-1.5 md:px-3 md:py-2 text-xs font-medium uppercase tracking-wider text-text/50">
                                                                Setting
                                                            </th>
                                                            <th className="text-right px-2 py-1.5 md:px-3 md:py-2 text-xs font-medium uppercase tracking-wider text-text/50">
                                                                Value
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {currentCategory?.settings.map((setting, sIdx) => (
                                                            <tr
                                                                key={sIdx}
                                                                className="border-t border-border"
                                                            >
                                                                <td className="px-2 py-1.5 md:px-3 md:py-2 text-text/70">
                                                                    {setting.title}
                                                                </td>
                                                                <td className="px-2 py-1.5 md:px-3 md:py-2 text-right font-medium text-text">
                                                                    {formatValue(setting.value)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-border bg-text/2">
                                        <p className="text-sm text-text/40">
                                            No settings data
                                        </p>
                                    </div>
                                )}

                                {/* Notes */}
                                {preset.userNotes && (
                                    <div className="mt-4 pt-4 border-t border-border">
                                        <h3 className="text-sm font-medium text-text/80 mb-2">
                                            Notes
                                        </h3>
                                        <TiptapRenderer content={preset.userNotes} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </>
        </AnimatePresence>
    )
}

function MetaItem({
    label,
    value,
    className,
}: {
    label: string
    value: string | null
    className?: string
}) {
    return (
        <div className={`flex flex-col gap-1 ${className || ""}`}>
            <span className="text-[10px] text-text/50 uppercase tracking-wider">
                {label}
            </span>
            <span className="text-sm text-text/80 break-words">
                {value ?? "—"}
            </span>
        </div>
    )
}

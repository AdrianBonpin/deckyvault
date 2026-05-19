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
import { ScreenshotLightbox } from "@/components/ui/screenshot-lightbox"

type TabKey = "details" | "media" | "settings" | "notes"

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
    loadTimeSsd: number | null
    loadTimeSd: number | null
    tdpWatts: number | null
    youtubeVideoId: string | null
    screenshots: Array<{
        id: string
        url: string
        width: number
        height: number
    }> | null
    hardwareWattHours: number | null
    hardwareDeviceType: string | null
    customSystem: boolean
    userNotes: string | null
    userId: string
    userName: string | null
    userImage: string | null
    verifiedAt: string | null
    isPinned: boolean
    pinnedAt: string | null
    createdAt: string
    versionString: string | null
    buildId: string | null
    gameAntiCheatName: string | null
    gameAntiCheatStatus: "none" | "supported" | "unsupported" | "unknown" | null
}

interface PresetDetailModalProps {
    preset: Preset
    gameId: string
    gameSource: string
    gameSteamAppId: number | null
    gameSlug: string | null
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

function MetaItem({
    label,
    value,
}: {
    label: string
    value: React.ReactNode | string | null
}) {
    return (
        <div className='flex items-center justify-between py-1'>
            <span className='text-xs text-text/50'>{label}</span>
            <span className='text-sm text-text/80 font-medium'>
                {value ?? "—"}
            </span>
        </div>
    )
}

function hasPerformanceData(p: Preset): boolean {
    return (
        p.fpsAvg !== null ||
        p.fpsOnePercentLow !== null ||
        p.loadTimeSsd !== null ||
        p.loadTimeSd !== null
    )
}

function hasHardwarePowerData(p: Preset): boolean {
    return p.tdpWatts !== null || p.hardwareWattHours !== null
}

function hasSoftwareData(p: Preset): boolean {
    return !!(
        p.protonVersion ||
        p.osVersion ||
        (p.upscalerType && p.upscalerType !== "none") ||
        (p.frameGenMethod && p.frameGenMethod !== "none") ||
        p.launchOptions
    )
}

function hasGameInfoData(p: Preset): boolean {
    return !!(p.versionString || p.buildId || p.gameAntiCheatName)
}

export function PresetDetailModal({
    preset,
    gameId,
    gameSource,
    gameSteamAppId,
    gameSlug,
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
    const [activeTab, setActiveTab] = useState<TabKey>("media")
    const [lightboxOpen, setLightboxOpen] = useState(false)
    const [lightboxIndex, setLightboxIndex] = useState(0)

    const isOwner = session?.user?.id === preset.userId
    const isAdmin = session?.user?.role === "admin"
    const isAuthenticated = !!session?.user

    const handleShare = () => {
        let identifier: string
        if (gameSource === "steam" && gameSteamAppId != null) {
            identifier = String(gameSteamAppId)
        } else if (gameSlug) {
            identifier = gameSlug
        } else {
            identifier = gameId // fallback for edge cases
        }
        const url = `${window.location.origin}/game/${identifier}?preset=${preset.id}`
        navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const categories = preset.settingsJson ?? []
    const hasCategories = categories.length > 0
    const currentCategory = hasCategories
        ? categories[activeCategoryIndex]
        : null

    const goPrevCategory = () => {
        setActiveCategoryIndex((prev) =>
            prev > 0 ? prev - 1 : categories.length - 1,
        )
    }

    const goNextCategory = () => {
        setActiveCategoryIndex((prev) =>
            prev < categories.length - 1 ? prev + 1 : 0,
        )
    }

    const handleUpvote = async () => {
        if (!isAuthenticated || userVote === "up") return
        try {
            const res = await fetch(`/api/performance/${preset.id}/upvote`, {
                method: "POST",
            })
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
            const res = await fetch(`/api/performance/${preset.id}/downvote`, {
                method: "POST",
            })
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
        onReport(preset.id, reportReason, reportDetails.trim() || undefined)
        setShowReportForm(false)
        setReportDetails("")
    }

    const handleTogglePin = async () => {
        const method = preset.isPinned ? "DELETE" : "POST"
        try {
            const res = await fetch(`/api/performance/${preset.id}/pin`, {
                method,
            })
            if (res.ok) {
                router.refresh()
            }
        } catch (err) {
            console.error("Failed to toggle pin:", err)
        }
    }

    const visibleTabs: TabKey[] = ["details", "media", "settings"]
    if (preset.userNotes) visibleTabs.push("notes")

    return (
        <AnimatePresence>
            <>
                {/* Backdrop */}
                <motion.div
                    key='backdrop'
                    className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                />

                {/* Modal container */}
                <motion.div
                    key='modal'
                    className='fixed inset-0 z-50 flex items-center justify-center p-4'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    {/* Modal card */}
                    <motion.div
                        className='relative w-full max-w-6xl h-[90vh] md:max-h-[90vh] overflow-hidden rounded-xl border border-border bg-background flex flex-col'
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
                        <div className='flex items-center justify-between p-5 border-b border-border shrink-0'>
                            <div className='flex items-center gap-3 min-w-0'>
                                <h2 className='text-base font-semibold text-text truncate'>
                                    {preset.hardwareName}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className='p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer shrink-0'
                                aria-label='Close'
                            >
                                <XIcon className='h-4 w-4 text-text/50' />
                            </button>
                        </div>

                        {/* Mobile tabs */}
                        <div className='flex md:hidden shrink-0 border-b border-border'>
                            {visibleTabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize cursor-pointer relative ${
                                        activeTab === tab
                                            ? "text-primary"
                                            : "text-text/50 hover:text-text/70"
                                    }`}
                                >
                                    {tab}
                                    <AnimatePresence>
                                        {activeTab === tab && (
                                            <motion.div
                                                layoutId='activeTabMobile'
                                                className='absolute w-full bottom-0 bg-primary h-0.5'
                                            />
                                        )}
                                    </AnimatePresence>
                                </button>
                            ))}
                        </div>

                        {/* Two-column body */}
                        <div className='flex flex-col md:flex-row overflow-hidden flex-1'>
                            {/* Left panel — Details (always visible on desktop, tab on mobile) */}
                            <div
                                className={`w-full md:w-1/3 md:min-w-60 flex-col gap-3 md:gap-4 p-4 md:p-5 border-b md:border-b-0 md:border-r border-border overflow-y-auto ${
                                    activeTab === "details"
                                        ? "flex"
                                        : "hidden md:flex"
                                }`}
                            >
                                {/* User info */}
                                <div className='flex items-center gap-3'>
                                    <div className='h-10 w-10 rounded-full bg-text/10 overflow-hidden flex items-center justify-center shrink-0'>
                                        {preset.userImage ? (
                                            <Image
                                                src={preset.userImage}
                                                alt={preset.userName || "User"}
                                                width={40}
                                                height={40}
                                                className='object-cover'
                                            />
                                        ) : (
                                            <UserIcon className='h-5 w-5 text-text/50' />
                                        )}
                                    </div>
                                    <div className='min-w-0'>
                                        <div className='flex items-center gap-2'>
                                            <span className='font-medium text-sm text-text truncate'>
                                                {preset.userName || "Anonymous"}
                                            </span>
                                            {preset.verifiedAt && (
                                                <span className='inline-flex items-center gap-1 text-green-400'>
                                                    <ShieldCheckIcon className='h-3.5 w-3.5' />
                                                    <span className='text-[10px]'>
                                                        Verified on{" "}
                                                        {new Date(
                                                            preset.verifiedAt,
                                                        ).toLocaleDateString(
                                                            undefined,
                                                            {
                                                                year: "numeric",
                                                                month: "short",
                                                                day: "numeric",
                                                            },
                                                        )}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                        <span className='text-xs text-text/50'>
                                            {formatDate(preset.createdAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className='h-px bg-border' />

                                {/* Actions */}
                                <div className='flex flex-wrap items-center gap-2'>
                                    {isAdmin && (
                                        <button
                                            onClick={handleTogglePin}
                                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-yellow-500/20 hover:bg-yellow-500/10 text-yellow-400 transition-colors cursor-pointer'
                                        >
                                            📌{" "}
                                            {preset.isPinned ? "Unpin" : "Pin"}
                                        </button>
                                    )}
                                    {(isOwner || isAdmin) && (
                                        <>
                                            {!showDeleteConfirm ? (
                                                <button
                                                    onClick={() =>
                                                        setShowDeleteConfirm(
                                                            true,
                                                        )
                                                    }
                                                    className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors cursor-pointer'
                                                >
                                                    <TrashIcon className='h-4 w-4' />
                                                    Delete
                                                </button>
                                            ) : (
                                                <div className='flex items-center gap-2'>
                                                    <span className='text-xs text-text/50'>
                                                        Are you sure?
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            onDelete(preset.id)
                                                            setShowDeleteConfirm(
                                                                false,
                                                            )
                                                        }}
                                                        className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors cursor-pointer'
                                                    >
                                                        Confirm
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            setShowDeleteConfirm(
                                                                false,
                                                            )
                                                        }
                                                        className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text/50 border border-border hover:bg-text/5 transition-colors cursor-pointer'
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {(isOwner || isAdmin) && (
                                        <button
                                            onClick={() =>
                                                router.push(
                                                    `/game/${gameId}/submit?edit=${preset.id}`,
                                                )
                                            }
                                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer'
                                        >
                                            <PencilIcon className='h-4 w-4' />
                                            Edit
                                        </button>
                                    )}
                                    <button
                                        onClick={handleShare}
                                        className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer'
                                    >
                                        <ShareIcon className='h-4 w-4' />
                                        {copied ? "Link copied!" : "Share"}
                                    </button>
                                    {session && !hasReported && (
                                        <>
                                            {!showReportForm ? (
                                                <button
                                                    onClick={() =>
                                                        setShowReportForm(true)
                                                    }
                                                    className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text/50 border border-border hover:bg-text/5 transition-colors cursor-pointer'
                                                >
                                                    <FlagIcon className='h-4 w-4' />
                                                    Report
                                                </button>
                                            ) : (
                                                <div className='flex flex-col gap-2 w-full'>
                                                    <select
                                                        value={reportReason}
                                                        onChange={(e) =>
                                                            setReportReason(
                                                                e.target
                                                                    .value as typeof reportReason,
                                                            )
                                                        }
                                                        className='text-sm bg-background border border-border rounded-md px-2 py-1.5 text-text/80 focus:outline-none focus:border-primary w-full max-w-xs'
                                                    >
                                                        <option value='inaccurate'>
                                                            Inaccurate data
                                                        </option>
                                                        <option value='spam'>
                                                            Spam
                                                        </option>
                                                        <option value='inappropriate'>
                                                            Inappropriate
                                                        </option>
                                                        <option value='other'>
                                                            Other
                                                        </option>
                                                    </select>
                                                    <textarea
                                                        value={reportDetails}
                                                        onChange={(e) =>
                                                            setReportDetails(
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder='Additional details (optional)'
                                                        rows={3}
                                                        className='text-sm bg-background border border-border rounded-md px-2 py-1.5 text-text/80 focus:outline-none focus:border-primary w-full resize-none'
                                                    />
                                                    <div className='flex items-center gap-2'>
                                                        <button
                                                            onClick={
                                                                handleReportSubmit
                                                            }
                                                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer'
                                                        >
                                                            Submit Report
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setShowReportForm(
                                                                    false,
                                                                )
                                                                setReportDetails(
                                                                    "",
                                                                )
                                                            }}
                                                            className='inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text/50 border border-border hover:bg-text/5 transition-colors cursor-pointer'
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {hasReported && (
                                        <span className='inline-flex items-center gap-1.5 text-sm text-text/50'>
                                            <FlagIcon className='h-4 w-4' />
                                            Reported
                                        </span>
                                    )}
                                </div>

                                <div className='h-px bg-border' />

                                {/* Vote buttons */}
                                <div className='flex items-center gap-3'>
                                    <button
                                        onClick={handleUpvote}
                                        disabled={
                                            !isAuthenticated ||
                                            userVote === "up"
                                        }
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                            userVote === "up"
                                                ? "bg-green-500/10 border-green-500/30 text-green-400"
                                                : "border-border text-text/70 hover:bg-text/5"
                                        } ${!isAuthenticated ? "opacity-50 cursor-not-allowed" : ""}`}
                                        title={
                                            !isAuthenticated
                                                ? "Sign in to vote"
                                                : undefined
                                        }
                                    >
                                        <ThumbsUpIcon className='h-4 w-4' />
                                        {localUpvotes}
                                    </button>
                                    <button
                                        onClick={handleDownvote}
                                        disabled={
                                            !isAuthenticated ||
                                            userVote === "down"
                                        }
                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                                            userVote === "down"
                                                ? "bg-red-500/10 border-red-500/30 text-red-400"
                                                : "border-border text-text/70 hover:bg-text/5"
                                        } ${!isAuthenticated ? "opacity-50 cursor-not-allowed" : ""}`}
                                        title={
                                            !isAuthenticated
                                                ? "Sign in to vote"
                                                : undefined
                                        }
                                    >
                                        <ThumbsDownIcon className='h-4 w-4' />
                                        {localDownvotes}
                                    </button>
                                </div>

                                {/* Performance group */}
                                {hasPerformanceData(preset) && (
                                    <div className='rounded-lg border border-border bg-text/3 p-3 py-1'>
                                        <span className='text-[10px] text-text/40 uppercase tracking-wider font-medium'>
                                            Performance
                                        </span>
                                        <div className='mt-2 flex flex-col gap-0.5'>
                                            {preset.fpsAvg !== null && (
                                                <MetaItem
                                                    label='Avg FPS'
                                                    value={
                                                        <>
                                                            <span className='font-semibold tabular-nums'>
                                                                {preset.fpsAvg}
                                                            </span>
                                                            {preset.fpsLow !==
                                                                null &&
                                                                preset.fpsHigh !==
                                                                    null && (
                                                                    <span className='text-text/50 ml-1'>
                                                                        (
                                                                        {Math.round(
                                                                            preset.fpsLow,
                                                                        )}
                                                                        –
                                                                        {Math.round(
                                                                            preset.fpsHigh,
                                                                        )}
                                                                        )
                                                                    </span>
                                                                )}
                                                        </>
                                                    }
                                                />
                                            )}
                                            {preset.fpsOnePercentLow !==
                                                null && (
                                                <MetaItem
                                                    label='1% Low FPS'
                                                    value={`${preset.fpsOnePercentLow} fps`}
                                                />
                                            )}
                                            {preset.loadTimeSsd !== null && (
                                                <MetaItem
                                                    label='Load Time (SSD)'
                                                    value={`${preset.loadTimeSsd}s`}
                                                />
                                            )}
                                            {preset.loadTimeSd !== null && (
                                                <MetaItem
                                                    label='Load Time (SD)'
                                                    value={`${preset.loadTimeSd}s`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Hardware & Power group */}
                                {hasHardwarePowerData(preset) && (
                                    <div className='rounded-lg border border-border bg-text/3 p-3 py-1'>
                                        <span className='text-[10px] text-text/40 uppercase tracking-wider font-medium'>
                                            Hardware & Power
                                        </span>
                                        <div className='mt-2 flex flex-col gap-0.5'>
                                            {preset.tdpWatts !== null && (
                                                <MetaItem
                                                    label='TDP'
                                                    value={`${Math.round(preset.tdpWatts)}W`}
                                                />
                                            )}
                                            {preset.hardwareWattHours !==
                                                null &&
                                                preset.hardwareDeviceType ===
                                                    "handheld" && (
                                                    <MetaItem
                                                        label='Battery'
                                                        value={`${Math.round(preset.hardwareWattHours)}Wh`}
                                                    />
                                                )}
                                            {preset.tdpWatts !== null &&
                                                preset.hardwareWattHours !==
                                                    null &&
                                                preset.hardwareDeviceType ===
                                                    "handheld" && (
                                                    <MetaItem
                                                        label='Est. Battery'
                                                        value={`~${(preset.hardwareWattHours / preset.tdpWatts).toFixed(1)}h`}
                                                    />
                                                )}
                                        </div>
                                    </div>
                                )}

                                {/* Software group */}
                                {hasSoftwareData(preset) && (
                                    <div className='rounded-lg border border-border bg-text/3 p-3 py-1'>
                                        <span className='text-[10px] text-text/40 uppercase tracking-wider font-medium'>
                                            Software
                                        </span>
                                        <div className='mt-2 flex flex-col gap-0.5'>
                                            <MetaItem
                                                label='Proton'
                                                value={preset.protonVersion}
                                            />
                                            <MetaItem
                                                label='OS'
                                                value={preset.osVersion}
                                            />
                                            <MetaItem
                                                label='Upscaler'
                                                value={
                                                    preset.upscalerType &&
                                                    preset.upscalerType !==
                                                        "none"
                                                        ? `${preset.upscalerType.toUpperCase()}${preset.upscalerVersion ? ` ${preset.upscalerVersion}` : ""}`
                                                        : null
                                                }
                                            />
                                            <MetaItem
                                                label='Frame Gen'
                                                value={
                                                    preset.frameGenMethod &&
                                                    preset.frameGenMethod !==
                                                        "none"
                                                        ? preset.frameGenMethod ===
                                                          "fsr_fg"
                                                            ? "FSR FG"
                                                            : preset.frameGenMethod ===
                                                                "dlss_fg"
                                                              ? "DLSS FG"
                                                              : preset.frameGenMethod
                                                        : null
                                                }
                                            />
                                            <MetaItem
                                                label='Launch Options'
                                                value={preset.launchOptions}
                                            />
                                            {preset.customSystem && (
                                                <MetaItem
                                                    label='Custom System'
                                                    value='Yes'
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Game Info group */}
                                {hasGameInfoData(preset) && (
                                    <div className='rounded-lg border border-border bg-text/3 p-3 py-1'>
                                        <span className='text-[10px] text-text/40 uppercase tracking-wider font-medium'>
                                            Game Info
                                        </span>
                                        <div className='mt-2 flex flex-col gap-0.5'>
                                            {preset.versionString && (
                                                <MetaItem
                                                    label='Version'
                                                    value={preset.versionString}
                                                />
                                            )}
                                            {preset.buildId && (
                                                <MetaItem
                                                    label='Build'
                                                    value={String(
                                                        preset.buildId,
                                                    )}
                                                />
                                            )}
                                            {preset.gameAntiCheatName && (
                                                <MetaItem
                                                    label='Anti-Cheat'
                                                    value={`${preset.gameAntiCheatName} (${preset.gameAntiCheatStatus ?? "unknown"})`}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right panel — Tabbed content */}
                            <div className='flex-1 flex flex-col overflow-hidden'>
                                {/* Desktop tab bar */}
                                <div className='hidden md:flex shrink-0 border-b border-border'>
                                    {[
                                        "media",
                                        "settings",
                                        ...(preset.userNotes
                                            ? ["notes" as TabKey]
                                            : []),
                                    ].map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() =>
                                                setActiveTab(tab as TabKey)
                                            }
                                            className={`py-2.5 flex-1 text-sm font-medium transition-colors capitalize cursor-pointer relative ${
                                                activeTab === tab
                                                    ? "text-primary"
                                                    : "text-text/50 hover:text-text/70"
                                            }`}
                                        >
                                            {tab}
                                            <AnimatePresence>
                                                {activeTab === tab && (
                                                    <motion.div
                                                        layoutId='activeTab'
                                                        className='absolute w-full bottom-0 bg-primary h-0.5'
                                                    />
                                                )}
                                            </AnimatePresence>
                                        </button>
                                    ))}
                                </div>

                                {/* Tab content */}
                                <div className='flex-1 overflow-y-auto p-5'>
                                    {/* Media tab */}
                                    {activeTab === "media" && (
                                        <div className='flex flex-col gap-4'>
                                            {/* YouTube Video */}
                                            {preset.youtubeVideoId && (
                                                <div>
                                                    <div
                                                        className='relative w-full'
                                                        style={{
                                                            paddingBottom:
                                                                "56.25%",
                                                        }}
                                                    >
                                                        <iframe
                                                            src={`https://www.youtube-nocookie.com/embed/${preset.youtubeVideoId}`}
                                                            className='absolute inset-0 w-full h-full rounded-lg'
                                                            allow='accelerometer; autoplay; encrypted-media; picture-in-picture'
                                                            sandbox='allow-scripts allow-same-origin allow-presentation'
                                                            allowFullScreen
                                                            loading='lazy'
                                                            title='Gameplay Video'
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Screenshots */}
                                            {preset.screenshots &&
                                                preset.screenshots.length >
                                                    0 && (
                                                    <div className='flex flex-col gap-3'>
                                                        <span className='text-xs text-text/50 uppercase tracking-wider'>
                                                            Screenshots
                                                        </span>
                                                        <div className='flex flex-col gap-3'>
                                                            {preset.screenshots.map(
                                                                (ss, i) => (
                                                                    <button
                                                                        key={
                                                                            ss.id
                                                                        }
                                                                        onClick={() => {
                                                                            setLightboxIndex(
                                                                                i,
                                                                            )
                                                                            setLightboxOpen(
                                                                                true,
                                                                            )
                                                                        }}
                                                                        className='block cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg overflow-hidden w-full'
                                                                        aria-label={`View screenshot ${i + 1}`}
                                                                    >
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img
                                                                            src={
                                                                                ss.url
                                                                            }
                                                                            alt={`Screenshot ${i + 1}`}
                                                                            className='w-full h-auto object-cover border border-border hover:border-primary/50 transition-colors rounded-lg'
                                                                            loading='lazy'
                                                                        />
                                                                    </button>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            {!preset.youtubeVideoId &&
                                                (!preset.screenshots ||
                                                    preset.screenshots
                                                        .length === 0) && (
                                                    <div className='flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-border bg-text/2'>
                                                        <p className='text-sm text-text/40'>
                                                            No media available
                                                        </p>
                                                    </div>
                                                )}
                                        </div>
                                    )}

                                    {/* Settings tab */}
                                    {activeTab === "settings" && (
                                        <>
                                            {hasCategories ? (
                                                <AnimatePresence mode='wait'>
                                                    <motion.div
                                                        key={
                                                            currentCategory?.category ??
                                                            "empty"
                                                        }
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{
                                                            duration: 0.15,
                                                        }}
                                                        className='flex flex-col gap-4'
                                                    >
                                                        {/* Category navigation */}
                                                        <div className='flex items-center justify-between'>
                                                            <button
                                                                onClick={
                                                                    goPrevCategory
                                                                }
                                                                className='p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer'
                                                                aria-label='Previous category'
                                                            >
                                                                <ChevronLeftIcon className='h-4 w-4 text-text/50' />
                                                            </button>
                                                            <span className='text-sm font-medium text-text/80'>
                                                                {
                                                                    currentCategory?.category
                                                                }{" "}
                                                                <span className='text-text/40'>
                                                                    (
                                                                    {activeCategoryIndex +
                                                                        1}
                                                                    /
                                                                    {
                                                                        categories.length
                                                                    }
                                                                    )
                                                                </span>
                                                            </span>
                                                            <button
                                                                onClick={
                                                                    goNextCategory
                                                                }
                                                                className='p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer'
                                                                aria-label='Next category'
                                                            >
                                                                <ChevronRightIcon className='h-4 w-4 text-text/50' />
                                                            </button>
                                                        </div>

                                                        {/* Settings table */}
                                                        <div className='rounded-lg border border-border overflow-hidden'>
                                                            <table className='w-full text-sm'>
                                                                <thead className='bg-text/3'>
                                                                    <tr>
                                                                        <th className='text-left px-2 py-1.5 md:px-3 md:py-2 text-xs font-medium uppercase tracking-wider text-text/50'>
                                                                            Setting
                                                                        </th>
                                                                        <th className='text-right px-2 py-1.5 md:px-3 md:py-2 text-xs font-medium uppercase tracking-wider text-text/50'>
                                                                            Value
                                                                        </th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {currentCategory?.settings.map(
                                                                        (
                                                                            setting,
                                                                            sIdx,
                                                                        ) => (
                                                                            <tr
                                                                                key={
                                                                                    sIdx
                                                                                }
                                                                                className='border-t border-border'
                                                                            >
                                                                                <td className='px-2 py-1.5 md:px-3 md:py-2 text-text/70'>
                                                                                    {
                                                                                        setting.title
                                                                                    }
                                                                                </td>
                                                                                <td className='px-2 py-1.5 md:px-3 md:py-2 text-right font-medium text-text'>
                                                                                    {formatValue(
                                                                                        setting.value,
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ),
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </motion.div>
                                                </AnimatePresence>
                                            ) : (
                                                <div className='flex flex-col items-center justify-center py-16 gap-3 rounded-lg border border-border bg-text/2'>
                                                    <p className='text-sm text-text/40'>
                                                        No settings data
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Notes tab */}
                                    {activeTab === "notes" &&
                                        preset.userNotes && (
                                            <TiptapRenderer
                                                content={preset.userNotes}
                                            />
                                        )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* Screenshot Lightbox */}
                {lightboxOpen &&
                    preset.screenshots &&
                    preset.screenshots.length > 0 && (
                        <ScreenshotLightbox
                            screenshots={preset.screenshots}
                            initialIndex={lightboxIndex}
                            onClose={() => setLightboxOpen(false)}
                        />
                    )}
            </>
        </AnimatePresence>
    )
}

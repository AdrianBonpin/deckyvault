"use client"

import { useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import { useSession } from "@/lib/auth-client"
import type { GameSettingCategory } from "@/lib/db/schema/performanceEntries"
import {
    TrendingUpIcon,
    TrendingDownIcon,
    FlagIcon,
    TrashIcon,
    ChevronDownIcon,
    ShieldCheckIcon,
    XIcon,
    UserIcon,
} from "lucide-react"

interface Preset {
    id: string
    hardwareSlug: string
    hardwareName: string
    upvotes: number
    downvotes: number
    settingsJson: GameSettingCategory[] | null
    settingsCount: number
    fpsAvg: number | null
    fpsLow: number | null
    fpsHigh: number | null
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
    createdAt: string
}

interface PresetDetailModalProps {
    preset: Preset
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
    onClose,
    onDelete,
    onReport,
    hasReported,
}: PresetDetailModalProps) {
    const { data: session } = useSession()

    const [openCategories, setOpenCategories] = useState<Set<number>>(
        new Set(),
    )
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showReportForm, setShowReportForm] = useState(false)
    const [reportReason, setReportReason] = useState<
        "inaccurate" | "spam" | "inappropriate" | "other"
    >("inaccurate")
    const [reportDetails, setReportDetails] = useState("")

    const isOwner = session?.user?.id === preset.userId
    const isAdmin = session?.user?.role === "admin"

    const toggleCategory = (index: number) => {
        setOpenCategories((prev) => {
            const next = new Set(prev)
            if (next.has(index)) {
                next.delete(index)
            } else {
                next.add(index)
            }
            return next
        })
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
                        layoutId={preset.id}
                        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 300,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between p-5 border-b border-border">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-full bg-text/10 overflow-hidden flex items-center justify-center shrink-0">
                                    {preset.userImage ? (
                                        <Image
                                            src={preset.userImage}
                                            alt={
                                                preset.userName || "User"
                                            }
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
                                        <span className="font-semibold text-sm text-text truncate">
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
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer shrink-0"
                                aria-label="Close"
                            >
                                <XIcon className="h-4 w-4 text-text/50" />
                            </button>
                        </div>

                        {/* Stats Row */}
                        <div className="grid grid-cols-3 gap-4 p-5 border-b border-border">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-text/50 uppercase tracking-wider">
                                    Upvotes
                                </span>
                                <div className="flex items-center gap-1.5 text-sm text-text">
                                    <TrendingUpIcon className="h-4 w-4 text-green-400" />
                                    <span className="font-semibold">
                                        {preset.upvotes}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-text/50 uppercase tracking-wider">
                                    Downvotes
                                </span>
                                <div className="flex items-center gap-1.5 text-sm text-text">
                                    <TrendingDownIcon className="h-4 w-4 text-red-400" />
                                    <span className="font-semibold">
                                        {preset.downvotes}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-text/50 uppercase tracking-wider">
                                    Avg FPS
                                </span>
                                <div className="text-sm text-text">
                                    <span className="font-semibold tabular-nums">
                                        {preset.fpsAvg ?? "—"}
                                    </span>
                                    {preset.fpsAvg !== null &&
                                        preset.fpsLow !== null &&
                                        preset.fpsHigh !== null && (
                                            <span className="text-text/50 ml-1">
                                                ({Math.round(preset.fpsLow)}
                                                –
                                                {Math.round(preset.fpsHigh)})
                                            </span>
                                        )}
                                </div>
                            </div>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-5 border-b border-border">
                            <MetaItem
                                label="Proton"
                                value={preset.protonVersion}
                            />
                            <MetaItem
                                label="SteamOS"
                                value={preset.osVersion}
                            />
                            <MetaItem
                                label="Upscaler"
                                value={
                                    preset.upscalerType &&
                                    preset.upscalerType !== "none"
                                        ? `${preset.upscalerType.toUpperCase()}${preset.upscalerVersion ? ` ${preset.upscalerVersion}` : ""}`
                                        : null
                                }
                            />
                            <MetaItem
                                label="Frame Gen"
                                value={
                                    preset.frameGenMethod &&
                                    preset.frameGenMethod !== "none"
                                        ? preset.frameGenMethod === "fsr_fg"
                                            ? "FSR FG"
                                            : preset.frameGenMethod ===
                                                "dlss_fg"
                                              ? "DLSS FG"
                                              : preset.frameGenMethod
                                        : null
                                }
                            />
                            <MetaItem
                                label="Launch Options"
                                value={preset.launchOptions}
                                className="col-span-2 sm:col-span-3"
                            />
                        </div>

                        {/* Settings Table */}
                        {preset.settingsJson &&
                            preset.settingsJson.length > 0 && (
                                <div className="p-5 border-b border-border">
                                    <h3 className="text-sm font-medium text-text/80 mb-3">
                                        Settings ({preset.settingsCount})
                                    </h3>
                                    <div className="flex flex-col gap-2">
                                        {preset.settingsJson.map(
                                            (category, idx) => (
                                                <div
                                                    key={idx}
                                                    className="rounded-lg border border-border overflow-hidden"
                                                >
                                                    <button
                                                        onClick={() =>
                                                            toggleCategory(idx)
                                                        }
                                                        className="w-full flex items-center justify-between px-3 py-2.5 bg-text/3 hover:bg-text/5 transition-colors cursor-pointer"
                                                    >
                                                        <span className="text-xs font-semibold uppercase tracking-wider text-text/70">
                                                            {category.category}
                                                        </span>
                                                        <ChevronDownIcon
                                                            className={`h-4 w-4 text-text/50 transition-transform duration-200 ${openCategories.has(idx) ? "rotate-180" : ""}`}
                                                        />
                                                    </button>
                                                    <AnimatePresence>
                                                        {openCategories.has(
                                                            idx,
                                                        ) && (
                                                            <motion.div
                                                                initial={{
                                                                    height: 0,
                                                                    opacity: 0,
                                                                }}
                                                                animate={{
                                                                    height: "auto",
                                                                    opacity: 1,
                                                                }}
                                                                exit={{
                                                                    height: 0,
                                                                    opacity: 0,
                                                                }}
                                                                transition={{
                                                                    duration: 0.2,
                                                                }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="flex flex-col">
                                                                    {category.settings.map(
                                                                        (
                                                                            setting,
                                                                            sIdx,
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    sIdx
                                                                                }
                                                                                className="flex items-center justify-between px-3 py-2 border-t border-border text-sm"
                                                                            >
                                                                                <span className="text-text/70">
                                                                                    {
                                                                                        setting.title
                                                                                    }
                                                                                </span>
                                                                                <span className="font-medium text-text">
                                                                                    {formatValue(
                                                                                        setting.value,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}

                        {/* User Notes */}
                        {preset.userNotes && (
                            <div className="p-5 border-b border-border">
                                <h3 className="text-sm font-medium text-text/80 mb-2">
                                    Notes
                                </h3>
                                <p className="text-sm text-text/70 whitespace-pre-line leading-relaxed">
                                    {preset.userNotes}
                                </p>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-3 p-5">
                            {(isOwner || isAdmin) && (
                                <>
                                    {!showDeleteConfirm ? (
                                        <button
                                            onClick={() =>
                                                setShowDeleteConfirm(true)
                                            }
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
                                                    setShowDeleteConfirm(
                                                        false,
                                                    )
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors cursor-pointer"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setShowDeleteConfirm(false)
                                                }
                                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text/50 border border-border hover:bg-text/5 transition-colors cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {session && !hasReported && (
                                <>
                                    {!showReportForm ? (
                                        <button
                                            onClick={() =>
                                                setShowReportForm(true)
                                            }
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
                                                        e.target
                                                            .value as typeof reportReason,
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
                                                    setReportDetails(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Additional details (optional)"
                                                rows={3}
                                                className="text-sm bg-background border border-border rounded-md px-2 py-1.5 text-text/80 focus:outline-none focus:border-primary w-full resize-none"
                                            />
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={
                                                        handleReportSubmit
                                                    }
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary border border-primary/20 hover:bg-primary/10 transition-colors cursor-pointer"
                                                >
                                                    Submit Report
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowReportForm(
                                                            false,
                                                        )
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

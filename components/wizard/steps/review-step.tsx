"use client"

import { useEffect, useRef, useState } from "react"
import { motion, Reorder, useDragControls } from "motion/react"
import {
    Send,
    Loader2,
    AlertCircle,
    Monitor,
    Gauge,
    SlidersHorizontal,
    Terminal,
    FileText,
    ImagePlus,
    X,
    GripVertical,
    Upload,
    ImageIcon,
} from "lucide-react"
import { TiptapEditor } from "@/components/tiptap-editor"
import type { SettingCategory } from "@/components/wizard/settings-editor"
import type { PerformanceData } from "./performance-step"
import type { EnvironmentData } from "./environment-step"
import { UPSCALER_TYPE_OPTIONS, FRAME_GEN_OPTIONS } from "./environment-step"

export interface ExistingScreenshot {
  type: "existing"
  id: string
  url: string
  width: number
  height: number
  orderIndex: number
}

export interface ReviewData {
    hardwareSlug: string
    hardwareName: string
    hardwareWattHours: number | null
    hardwareDeviceType: string | null
    gameVersionLabel: string
    antiCheat: {
        antiCheatRelevant: boolean
        antiCheatName: string
        antiCheatStatus: "none" | "supported" | "unsupported" | "unknown"
    }
    performance: PerformanceData
    settings: SettingCategory[]
    environment: EnvironmentData
}

interface ReviewStepProps {
    data: ReviewData
    userNotes: string
    onUserNotesChange: (notes: string) => void
    onSubmit: () => void
    isSubmitting: boolean
    error: string | null
    screenshotFiles: File[]
    onScreenshotFilesChange: (files: File[]) => void
    submitPhase: "idle" | "uploading" | "saving" | "success" | "error"
    existingScreenshots?: ExistingScreenshot[]
    onRemoveExistingScreenshot?: (id: string) => void
}

function SectionHeader({
    icon: Icon,
    label,
}: {
    icon: React.ElementType
    label: string
}) {
    return (
        <div className='flex items-center gap-2 mb-2'>
            <Icon className='h-3.5 w-3.5 text-primary' />
            <span className='text-xs font-semibold text-text/80 uppercase tracking-wider'>
                {label}
            </span>
        </div>
    )
}

function SummaryRow({
    label,
    value,
}: {
    label: string
    value: React.ReactNode
}) {
    return (
        <div className='flex items-center justify-between py-1.5 border-b border-border/50 last:border-b-0'>
            <span className='text-xs text-text/50'>{label}</span>
            <span className='text-xs text-text font-medium'>{value}</span>
        </div>
    )
}

function formatNumber(val: number | undefined): string {
    if (val === undefined || val === null) return "Not set"
    return String(val)
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ScreenshotCard({
    file,
    url,
    index,
    onRemove,
}: {
    file: File
    url: string
    index: number
    onRemove: () => void
}) {
    const dragControls = useDragControls()

    return (
        <Reorder.Item
            value={file}
            dragListener={false}
            dragControls={dragControls}
            as='div'
            className='group relative rounded-xl border border-border bg-text/3 overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-shadow transition-colors transition-[border-color]'
            whileDrag={{
                scale: 1.02,
                boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
                zIndex: 20,
            }}
        >
            {/* Image */}
            <div className='relative aspect-video'>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={url}
                    alt={file.name}
                    className='w-full h-full object-cover'
                    draggable={false}
                />

                {/* Overlay gradient */}
                <div className='absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity' />

                {/* Drag handle (top-left) */}
                <div
                    className='absolute top-2 left-2 p-2 rounded-lg bg-black/50 text-white/80 hover:text-white hover:bg-black/70 backdrop-blur-sm cursor-grab active:cursor-grabbing transition-colors opacity-0 group-hover:opacity-100 select-none touch-none'
                    onPointerDown={(e) => { e.preventDefault(); dragControls.start(e) }}
                >
                    <GripVertical className='h-4 w-4' />
                </div>

                {/* Remove button (top-right) */}
                <button
                    type='button'
                    onClick={onRemove}
                    className='absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/80 hover:text-white hover:bg-red-500/80 backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 cursor-pointer'
                    title='Remove screenshot'
                >
                    <X className='h-3.5 w-3.5' />
                </button>

                {/* Index badge */}
                <div className='absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/90 opacity-0 group-hover:opacity-100 transition-opacity'>
                    #{index + 1}
                </div>

                {/* File info (bottom-right) */}
                <div className='absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-30'>
                    {formatFileSize(file.size)}
                </div>
            </div>

            {/* Filename bar */}
            <div className='px-3 py-2 border-t border-border/50'>
                <p
                    className='text-[11px] text-text/60 truncate'
                    title={file.name}
                >
                    {file.name}
                </p>
            </div>
        </Reorder.Item>
    )
}

export function ReviewStep({
    data,
    userNotes,
    onUserNotesChange,
    onSubmit,
    isSubmitting,
    error,
    screenshotFiles,
    onScreenshotFilesChange,
    submitPhase,
    existingScreenshots,
    onRemoveExistingScreenshot,
}: ReviewStepProps) {
    const {
        hardwareName,
        gameVersionLabel,
        antiCheat,
        performance,
        environment,
        settings,
    } = data

    // Stable URL mapping so reordering doesn't flicker
    const urlMapRef = useRef(new Map<File, string>())
    const [previewUrls, setPreviewUrls] = useState<string[]>([])
    const [isDragOver, setIsDragOver] = useState(false)

    useEffect(() => {
        const map = urlMapRef.current

        // Create URLs for new files
        for (const file of screenshotFiles) {
            if (!map.has(file)) {
                map.set(file, URL.createObjectURL(file))
            }
        }

        // Revoke URLs for removed files
        for (const [file, url] of Array.from(map.entries())) {
            if (!screenshotFiles.includes(file)) {
                URL.revokeObjectURL(url)
                map.delete(file)
            }
        }

        setPreviewUrls(screenshotFiles.map((f) => map.get(f)!))
    }, [screenshotFiles])

    useEffect(() => {
        const map = urlMapRef.current
        return () => {
            for (const url of map.values()) {
                URL.revokeObjectURL(url)
            }
            map.clear()
        }
    }, [])

    const handleFiles = (files: FileList | null) => {
        if (!files) return
        const incoming = Array.from(files).filter((f) =>
            /image\/(jpeg|png|webp)/.test(f.type),
        )
        const current = screenshotFiles || []
        const combined = [...current, ...incoming].slice(0, 2)
        onScreenshotFilesChange?.(combined)
    }

    const removeFile = (file: File) => {
        const newFiles = (screenshotFiles || []).filter((f) => f !== file)
        onScreenshotFilesChange?.(newFiles)
    }

    const handleReorder = (newFiles: File[]) => {
        onScreenshotFilesChange(newFiles)
    }

    const upscalerLabel = (() => {
        if (
            !data.environment.upscalerType ||
            data.environment.upscalerType === "none"
        )
            return "None"
        const opt = UPSCALER_TYPE_OPTIONS.find(
            (o) => o.value === data.environment.upscalerType,
        )
        const base = opt?.label ?? data.environment.upscalerType
        return data.environment.upscalerVersion
            ? `${base} ${data.environment.upscalerVersion}`
            : base
    })()

    const frameGenLabel = (() => {
        if (
            !environment.frameGenMethod ||
            environment.frameGenMethod === "none"
        )
            return "None"
        const opt = FRAME_GEN_OPTIONS.find(
            (o) => o.value === environment.frameGenMethod,
        )
        return opt?.label ?? environment.frameGenMethod
    })()

    const canUploadMore =
        (!screenshotFiles || screenshotFiles.length < 2) &&
        submitPhase !== "uploading" &&
        submitPhase !== "saving"

    return (
        <div className='space-y-6'>
            <div className='flex items-start gap-3'>
                <FileText className='h-4 w-4 text-primary mt-0.5 shrink-0' />
                <div>
                    <h3 className='text-sm font-semibold text-text'>
                        Review & Submit
                    </h3>
                    <p className='text-xs text-text/60 mt-1'>
                        Review your submission details below. Add any additional
                        notes and click Submit when ready.
                    </p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                {/* Setup: Hardware + Version + Anti-Cheat */}
                <div className='rounded-lg border border-border bg-text/5 p-4'>
                    <SectionHeader
                        icon={Monitor}
                        label='Setup'
                    />
                    <SummaryRow
                        label='Device'
                        value={
                            hardwareName || data.hardwareSlug || "Not selected"
                        }
                    />
                    <SummaryRow
                        label='Game Version'
                        value={gameVersionLabel}
                    />
                    {antiCheat.antiCheatRelevant && (
                        <>
                            <SummaryRow
                                label='Anti-Cheat'
                                value={antiCheat.antiCheatName || "Unknown"}
                            />
                            <SummaryRow
                                label='Anti-Cheat Status'
                                value={
                                    antiCheat.antiCheatStatus === "supported"
                                        ? "Supported"
                                        : antiCheat.antiCheatStatus ===
                                            "unsupported"
                                          ? "Unsupported"
                                          : antiCheat.antiCheatStatus ===
                                              "unknown"
                                            ? "Unknown"
                                            : "None"
                                }
                            />
                        </>
                    )}
                    {!antiCheat.antiCheatRelevant && (
                        <SummaryRow
                            label='Anti-Cheat'
                            value='None'
                        />
                    )}
                </div>

                {/* Performance */}
                <div className='rounded-lg border border-border bg-text/5 p-4'>
                    <SectionHeader
                        icon={Gauge}
                        label='Performance'
                    />
                    <SummaryRow
                        label='FPS Average'
                        value={formatNumber(performance.fpsAvg)}
                    />
                    <SummaryRow
                        label='1% Low FPS'
                        value={formatNumber(performance.fpsOnePercentLow)}
                    />
                    <SummaryRow
                        label='FPS Low'
                        value={formatNumber(performance.fpsLow)}
                    />
                    <SummaryRow
                        label='FPS High'
                        value={formatNumber(performance.fpsHigh)}
                    />
                    <SummaryRow
                        label='Load Time SSD'
                        value={formatNumber(performance.loadTimeSsd)}
                    />
                    <SummaryRow
                        label='Load Time SD'
                        value={formatNumber(performance.loadTimeSd)}
                    />
                    <SummaryRow
                        label='TDP (Watts)'
                        value={formatNumber(performance.tdpWatts)}
                    />
                    <SummaryRow
                        label='Est. Battery'
                        value={(() => {
                            const wh = data.hardwareWattHours
                            const tdp = performance.tdpWatts
                            if (
                                wh &&
                                tdp &&
                                tdp > 0 &&
                                data.hardwareDeviceType === "handheld"
                            ) {
                                const hours = wh / tdp
                                const mins = Math.round(hours * 60)
                                return `~${hours.toFixed(1)}h (${mins} min)`
                            }
                            return "Not available — requires TDP and a handheld device"
                        })()}
                    />
                </div>

                {/* Environment */}
                <div className='rounded-lg border border-border bg-text/5 p-4'>
                    <SectionHeader
                        icon={Terminal}
                        label='Environment'
                    />
                    <SummaryRow
                        label='Proton Version'
                        value={environment.protonVersion || "Not set"}
                    />
                    <SummaryRow
                        label='OS Version'
                        value={environment.osVersion || "Not set"}
                    />
                    <SummaryRow
                        label='Upscaler'
                        value={upscalerLabel}
                    />
                    <SummaryRow
                        label='Frame Gen'
                        value={frameGenLabel}
                    />
                    <SummaryRow
                        label='Custom System'
                        value={environment.customSystem ? "Yes" : "No"}
                    />
                    {environment.launchOptions && (
                        <SummaryRow
                            label='Launch Options'
                            value={
                                <span
                                    className='font-mono text-[10px] truncate max-w-40 block'
                                    title={environment.launchOptions}
                                >
                                    {environment.launchOptions}
                                </span>
                            }
                        />
                    )}
                    {environment.youtubeVideoId &&
                    /^[a-zA-Z0-9_-]{11}$/.test(environment.youtubeVideoId) ? (
                        <div className='mt-2'>
                            <span className='text-xs text-text/50'>
                                YouTube Video
                            </span>
                            <div
                                className='mt-1 relative'
                                style={{ paddingBottom: "56.25%" }}
                            >
                                <iframe
                                    src={`https://www.youtube-nocookie.com/embed/${environment.youtubeVideoId}`}
                                    className='absolute inset-0 w-full h-full rounded-md'
                                    allow='accelerometer; autoplay; encrypted-media; picture-in-picture'
                                    sandbox='allow-scripts allow-same-origin allow-presentation'
                                    allowFullScreen
                                    loading='lazy'
                                    title='Review: Gameplay Video'
                                />
                            </div>
                        </div>
                    ) : (
                        <SummaryRow
                            label='YouTube Video'
                            value='Not provided'
                        />
                    )}
                </div>

                {/* Settings */}
                <div className='rounded-lg border border-border bg-text/5 p-4'>
                    <SectionHeader
                        icon={SlidersHorizontal}
                        label='Settings'
                    />
                    {settings.length === 0 ? (
                        <p className='text-xs text-text/40 py-1'>
                            No settings configured
                        </p>
                    ) : (
                        <div className='space-y-2 max-h-40 overflow-y-auto'>
                            {settings.map((cat) => (
                                <div key={cat.category}>
                                    <p className='text-xs font-medium text-text/70'>
                                        {cat.category}
                                    </p>
                                    <div className='flex flex-wrap gap-1 mt-0.5'>
                                        {cat.settings.map((s) => (
                                            <span
                                                key={s.title}
                                                className='inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-text/10 text-text/60'
                                            >
                                                {s.title}: {String(s.value)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Screenshots */}
            <div className='space-y-3 overflow-clip'>
                <div className='flex items-center justify-between'>
                    <label className='text-xs font-medium text-text/60 flex items-center gap-1.5'>
                        <ImageIcon className='h-3.5 w-3.5 text-text/40' />
                        Screenshots
                        <span className='text-[10px] text-text/30 font-normal'>
                            ({screenshotFiles?.length ?? 0}/2)
                        </span>
                    </label>
                    {(submitPhase === "uploading" ||
                        submitPhase === "saving") && (
                        <div className='flex items-center gap-2 text-xs text-text/60'>
                            <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            <span>Uploading...</span>
                        </div>
                    )}
                </div>

                {data.settings.length === 0 ? (
                    <div className='rounded-lg border border-border bg-text/5 p-4'>
                        <p className='text-xs text-text/50'>
                            Add game settings to enable screenshot upload
                        </p>
                    </div>
                ) : (
                    <div className='space-y-3'>
                        {/* Existing screenshots (from edit mode) */}
                        {existingScreenshots && existingScreenshots.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] text-text/30 uppercase tracking-wider">Existing screenshots</p>
                                <div className="grid grid-cols-2 gap-3">
                                    {existingScreenshots.map((ss) => (
                                        <div
                                            key={ss.id}
                                            className="group relative rounded-xl border border-border bg-text/3 overflow-hidden"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={ss.url}
                                                alt={`Screenshot ${ss.orderIndex + 1}`}
                                                className="w-full aspect-video object-cover"
                                                draggable={false}
                                            />
                                            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <button
                                                type="button"
                                                onClick={() => onRemoveExistingScreenshot?.(ss.id)}
                                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/80 hover:text-white hover:bg-red-500/80 backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                title="Remove screenshot"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] font-medium text-white/90 opacity-0 group-hover:opacity-100">
                                                Existing · #{ss.orderIndex + 1}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Screenshot grid with drag-to-reorder */}
                        {screenshotFiles && screenshotFiles.length > 0 && (
                            <Reorder.Group
                                axis='x'
                                values={screenshotFiles}
                                onReorder={handleReorder}
                                as='div'
                                className='grid grid-cols-2 gap-3'
                            >
                                {screenshotFiles.map((file, idx) => (
                                    <ScreenshotCard
                                        key={
                                            file.name +
                                            file.size +
                                            file.lastModified
                                        }
                                        file={file}
                                        url={previewUrls[idx] || ""}
                                        index={idx}
                                        onRemove={() => removeFile(file)}
                                    />
                                ))}
                            </Reorder.Group>
                        )}

                        {/* Upload area */}
                        {canUploadMore ? (
                            <label
                                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all cursor-pointer ${
                                    isDragOver
                                        ? "border-primary bg-primary/5"
                                        : "border-border bg-text/2 hover:bg-text/5 hover:border-text/20"
                                }`}
                                onDragOver={(e) => {
                                    e.preventDefault()
                                    setIsDragOver(true)
                                }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={(e) => {
                                    e.preventDefault()
                                    setIsDragOver(false)
                                    handleFiles(e.dataTransfer.files)
                                }}
                            >
                                <div
                                    className={`p-2.5 rounded-full transition-colors ${
                                        isDragOver
                                            ? "bg-primary/15 text-primary"
                                            : "bg-text/5 text-text/30"
                                    }`}
                                >
                                    <Upload
                                        className={`h-5 w-5 transition-transform ${
                                            isDragOver ? "scale-110" : ""
                                        }`}
                                    />
                                </div>
                                <div className='text-center space-y-0.5'>
                                    <p className='text-xs text-text/60 font-medium'>
                                        {isDragOver
                                            ? "Drop screenshots here"
                                            : screenshotFiles &&
                                                screenshotFiles.length > 0
                                              ? "Add another screenshot"
                                              : "Add screenshots"}
                                    </p>
                                    <p className='text-[10px] text-text/30'>
                                        JPG, PNG, WebP · Max 2 files · Drag to
                                        upload
                                    </p>
                                </div>
                                <input
                                    type='file'
                                    accept='image/jpeg,image/png,image/webp'
                                    multiple
                                    onChange={(e) => {
                                        handleFiles(e.target.files)
                                        e.target.value = ""
                                    }}
                                    className='sr-only'
                                />
                            </label>
                        ) : (
                            <div className='flex items-center justify-center gap-2 rounded-xl border border-border bg-text/2 p-4 text-xs text-text/40'>
                                <ImagePlus className='h-4 w-4 text-text/20' />
                                Maximum 2 screenshots reached
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* User Notes */}
            <div className='space-y-2'>
                <label className='text-xs font-medium text-text/60'>
                    Additional Notes
                </label>
                <TiptapEditor
                    content={userNotes}
                    onChange={(json) => onUserNotesChange(JSON.stringify(json))}
                    placeholder='Add any extra details about your experience...'
                />
            </div>

            {/* Error */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className='flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3'
                >
                    <AlertCircle className='h-4 w-4 text-red-400 shrink-0' />
                    <p className='text-xs text-red-400'>{error}</p>
                </motion.div>
            )}

            {/* Submit Button */}
            <button
                type='button'
                onClick={onSubmit}
                disabled={isSubmitting}
                className='w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        {submitPhase === "uploading"
                            ? "Uploading screenshots..."
                            : submitPhase === "saving"
                              ? "Saving entry..."
                              : "Processing..."}
                    </>
                ) : (
                    <>
                        <Send className='h-4 w-4' />
                        Submit Entry
                    </>
                )}
            </button>
        </div>
    )
}

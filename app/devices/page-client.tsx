"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import {
    Gamepad2Icon,
    TrendingUpIcon,
    DatabaseIcon,
    ArrowRightIcon,
    MonitorIcon,
    CheckCircleIcon,
} from "lucide-react"
import { getDeviceColor } from "@/components/charts/EChartWrapper"

export interface DeviceStats {
    slug: string
    name: string
    deviceType: string
    image: string | null
    sortOrder: number
    colorIndex: number
    totalBenchmarks: number
    avgFps: number | null
    gameCount: number
    verifiedCount: number
    bestGame: {
        id: string
        title: string
        headerImage: string | null
        fpsAvg: number
    } | null
}

const deviceTypeLabel: Record<string, string> = {
    handheld: "Handheld",
    console: "Console",
}

const deviceTypeColor: Record<string, string> = {
    handheld: "text-primary bg-primary/10 border-primary/20",
    console: "text-secondary bg-secondary/10 border-secondary/20",
}

type FilterType = "all" | "handheld" | "console"

const filterOptions: { id: FilterType; label: string }[] = [
    { id: "all", label: "All" },
    { id: "handheld", label: "Handheld" },
    { id: "console", label: "Console" },
]

export function DevicesPageClient({ devices }: { devices: DeviceStats[] }) {
    const [activeFilter, setActiveFilter] = useState<FilterType>("all")

    const filteredDevices =
        activeFilter === "all"
            ? devices
            : devices.filter((d) => d.deviceType === activeFilter)

    if (devices.length === 0) {
        return (
            <div className='max-w-7xl mx-auto px-4 md:px-[10svw] py-8'>
                <div className='text-center py-16 text-text/40'>
                    <Gamepad2Icon className='h-10 w-10 mx-auto mb-2' />
                    <p>No devices found</p>
                    <p className='text-sm mt-1'>
                        Benchmark data will appear as devices are added
                    </p>
                </div>
            </div>
        )
    }

    return (
        <section className='w-full flex flex-col gap-8 py-16'>
            {/* Hero Header */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className='px-4 md:px-[10svw]'
            >
                <div className='max-w-7xl mx-auto'>
                    <h1 className='text-2xl sm:text-3xl font-bold'>Devices</h1>
                    <p className='text-sm text-text/60 mt-1'>
                        Browse benchmark data for handheld and console devices
                    </p>
                </div>
            </motion.div>

            {/* Filter Tabs */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className='px-4 md:px-[10svw]'
            >
                <div className='max-w-7xl mx-auto'>
                    <div className='flex items-center gap-2'>
                        {filterOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => setActiveFilter(opt.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                    activeFilter === opt.id
                                        ? "bg-primary/10 text-primary border border-primary/30"
                                        : "text-text/50 hover:text-text/70 hover:bg-text/5 border border-transparent"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Device Grid */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className='px-4 md:px-[10svw]'
            >
                <div className='max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {filteredDevices.map((device, i) => (
                        <motion.div
                            key={device.slug}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.3,
                                delay: Math.min(0.05 * i, 0.5),
                            }}
                        >
                            <Link
                                href={`/devices/${device.slug}`}
                                className='block rounded-xl border border-border bg-text/3 hover:border-primary/30 transition-colors group overflow-hidden'
                            >
                                {/* Image / Icon Header */}
                                <div
                                    className='relative h-28 flex items-center justify-center'
                                    style={{
                                        background: `${getDeviceColor(device.colorIndex)}08`,
                                    }}
                                >
                                    {device.image ? (
                                        <Image
                                            src={device.image}
                                            alt={device.name}
                                            fill
                                            className='object-contain p-4'
                                            sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                                        />
                                    ) : (
                                        <Gamepad2Icon
                                            className='h-12 w-12'
                                            style={{
                                                color: getDeviceColor(
                                                    device.colorIndex,
                                                ),
                                                opacity: 0.6,
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Card Body */}
                                <div className='p-5'>
                                    {/* Name & Type */}
                                    <div className='flex items-start justify-between gap-2 mb-3'>
                                        <div>
                                            <h2 className='text-lg font-semibold group-hover:text-primary transition-colors'>
                                                {device.name}
                                            </h2>
                                            <span
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize mt-1 ${
                                                    deviceTypeColor[
                                                        device.deviceType
                                                    ] ||
                                                    "text-text/50 bg-text/5 border-border"
                                                }`}
                                            >
                                                <Gamepad2Icon className='h-2.5 w-2.5' />
                                                {deviceTypeLabel[
                                                    device.deviceType
                                                ] || device.deviceType}
                                            </span>
                                        </div>
                                        <ArrowRightIcon className='h-5 w-5 text-text/20 group-hover:text-primary transition-colors' />
                                    </div>

                                    {/* Stats Row */}
                                    <div className='grid grid-cols-4 gap-2 mt-4'>
                                        <div className='flex flex-col items-center text-center'>
                                            <DatabaseIcon className='h-3.5 w-3.5 text-primary mb-1' />
                                            <span className='text-base font-bold tabular-nums'>
                                                {device.totalBenchmarks}
                                            </span>
                                            <span className='text-[9px] text-text/50'>
                                                Benchmarks
                                            </span>
                                        </div>
                                        <div className='flex flex-col items-center text-center'>
                                            <TrendingUpIcon className='h-3.5 w-3.5 text-green-400 mb-1' />
                                            <span className='text-base font-bold tabular-nums'>
                                                {device.avgFps !== null
                                                    ? device.avgFps
                                                    : "—"}
                                            </span>
                                            <span className='text-[9px] text-text/50'>
                                                Avg FPS
                                            </span>
                                        </div>
                                        <div className='flex flex-col items-center text-center'>
                                            <MonitorIcon className='h-3.5 w-3.5 text-accent mb-1' />
                                            <span className='text-base font-bold tabular-nums'>
                                                {device.gameCount}
                                            </span>
                                            <span className='text-[9px] text-text/50'>
                                                Games
                                            </span>
                                        </div>
                                        <div className='flex flex-col items-center text-center'>
                                            <CheckCircleIcon className='h-3.5 w-3.5 text-blue-400 mb-1' />
                                            <span className='text-base font-bold tabular-nums'>
                                                {device.verifiedCount}
                                            </span>
                                            <span className='text-[9px] text-text/50'>
                                                Verified
                                            </span>
                                        </div>
                                    </div>

                                    {/* Best game */}
                                    {device.bestGame && (
                                        <div className='mt-3 pt-3 border-t border-border text-xs text-text/50'>
                                            Top:{" "}
                                            <span className='text-text/80 font-medium'>
                                                {device.bestGame.title}
                                            </span>{" "}
                                            · {device.bestGame.fpsAvg} FPS
                                        </div>
                                    )}
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {filteredDevices.length === 0 && devices.length > 0 && (
                    <div className='text-center py-12 text-text/40'>
                        <Gamepad2Icon className='h-8 w-8 mx-auto mb-2' />
                        <p>No {activeFilter} devices found</p>
                    </div>
                )}
            </motion.div>
        </section>
    )
}

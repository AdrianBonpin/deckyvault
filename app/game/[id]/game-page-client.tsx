"use client"

import { useState } from "react"
import Image from "next/image"
import {
  Gamepad2Icon,
  MessageSquareIcon,
  SettingsIcon,
  TrendingUpIcon,
  ExternalLinkIcon,
  ClockIcon,
} from "lucide-react"

interface Game {
  id: string
  steamAppId: number | null
  title: string
  description: string | null
  developer: string | null
  publisher: string | null
  genres: string[] | null
  headerImage: string | null
  capsuleImage: string | null
  storeUrl: string | null
  source: string
  lastSync: string | null
  syncStatus: string | null
  createdAt: string
}

interface Counts {
  benchmarks: number
  presets: number
  comments: number
}

interface PlatformSupport {
  id: string
  gameId: string
  hardwareSlug: string
  isSupported: boolean
  protonStatus: string
}

const TABS = [
  { key: "overview", label: "Overview", icon: Gamepad2Icon },
  { key: "benchmarks", label: "Benchmarks", icon: TrendingUpIcon },
  { key: "presets", label: "Presets", icon: SettingsIcon },
  { key: "comments", label: "Comments", icon: MessageSquareIcon },
] as const

type TabKey = (typeof TABS)[number]["key"]

export function GamePageClient({
  game,
  counts,
  platformSupport,
}: {
  game: Game
  counts: Counts
  platformSupport: PlatformSupport[]
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview")

  const headerImage = game.headerImage || game.capsuleImage

  return (
    <section className="w-full flex flex-col">
      {/* Hero */}
      <div className="relative w-full h-48 sm:h-64 md:h-80 overflow-hidden">
        {headerImage ? (
          <Image
            src={headerImage}
            alt={game.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-text/10 flex items-center justify-center">
            <Gamepad2Icon className="h-16 w-16 text-text/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-[10svw] pb-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
              {game.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-text/70">
              {game.developer && <span>{game.developer}</span>}
              {game.developer && game.publisher && (
                <span className="text-text/40">•</span>
              )}
              {game.publisher && <span>{game.publisher}</span>}
              {game.genres && game.genres.length > 0 && (
                <>
                  <span className="text-text/40">•</span>
                  <span className="text-text/60">
                    {game.genres.join(", ")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 md:px-[10svw] border-b border-border">
        <div className="max-w-7xl mx-auto flex flex-row gap-6 py-3 text-sm">
          <StatBadge
            icon={TrendingUpIcon}
            value={counts.benchmarks}
            label="Benchmarks"
          />
          <StatBadge
            icon={SettingsIcon}
            value={counts.presets}
            label="Presets"
          />
          <StatBadge
            icon={MessageSquareIcon}
            value={counts.comments}
            label="Comments"
          />
          {game.storeUrl && (
            <a
              href={game.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 text-text/60 hover:text-primary transition-colors"
            >
              <ExternalLinkIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Store</span>
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 md:px-[10svw]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-row gap-1 border-b border-border mt-4">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-text/60 hover:text-text/80"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="py-6 min-h-[300px]">
            {activeTab === "overview" && (
              <OverviewTab game={game} platformSupport={platformSupport} />
            )}
            {activeTab === "benchmarks" && <BenchmarksTab count={counts.benchmarks} />}
            {activeTab === "presets" && <PresetsTab count={counts.presets} />}
            {activeTab === "comments" && <CommentsTab count={counts.comments} />}
          </div>
        </div>
      </div>
    </section>
  )
}

function StatBadge({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-text/70">
      <Icon className="h-4 w-4 text-text/50" />
      <span className="font-medium text-text">{value}</span>
      <span className="hidden sm:inline text-text/50">{label}</span>
    </div>
  )
}

function OverviewTab({
  game,
  platformSupport,
}: {
  game: Game
  platformSupport: PlatformSupport[]
}) {
  return (
    <div className="flex flex-col gap-6">
      {game.description && (
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-2">
            About
          </h3>
          <p className="text-sm text-text/80 leading-relaxed max-w-3xl">
            {game.description}
          </p>
        </div>
      )}

      {/* Platform Support */}
      {platformSupport.length > 0 && (
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-3">
            Platform Support
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {platformSupport.map((ps) => (
              <div
                key={ps.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-text/5"
              >
                <span className="text-sm font-medium capitalize">
                  {ps.hardwareSlug.replace(/-/g, " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      ps.isSupported
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {ps.isSupported ? "Supported" : "Unsupported"}
                  </span>
                  <span className="text-xs text-text/50 capitalize">
                    {ps.protonStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-3">
          Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <MetaItem label="Source" value={game.source} />
          {game.steamAppId && (
            <MetaItem label="Steam AppID" value={String(game.steamAppId)} />
          )}
          <MetaItem label="Added" value={formatDate(game.createdAt)} />
          {game.lastSync && (
            <MetaItem
              label="Last Sync"
              value={formatDate(game.lastSync)}
              icon={ClockIcon}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function MetaItem({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text/50 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-text/80 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3 text-text/40" />}
        {value}
      </span>
    </div>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString()
}

function BenchmarksTab({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <TrendingUpIcon className="h-12 w-12 text-text/20" />
        <p className="text-text/40 text-sm">No benchmarks yet</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <TrendingUpIcon className="h-12 w-12 text-text/20" />
      <p className="text-text/40 text-sm">
        {count} benchmark{count !== 1 ? "s" : ""} — coming soon
      </p>
    </div>
  )
}

function PresetsTab({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <SettingsIcon className="h-12 w-12 text-text/20" />
        <p className="text-text/40 text-sm">No presets yet</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <SettingsIcon className="h-12 w-12 text-text/20" />
      <p className="text-text/40 text-sm">
        {count} preset{count !== 1 ? "s" : ""} — coming soon
      </p>
    </div>
  )
}

function CommentsTab({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <MessageSquareIcon className="h-12 w-12 text-text/20" />
        <p className="text-text/40 text-sm">No comments yet</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <MessageSquareIcon className="h-12 w-12 text-text/20" />
      <p className="text-text/40 text-sm">
        {count} comment{count !== 1 ? "s" : ""} — coming soon
      </p>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import {
  Loader2,
  HardDriveIcon,
  TrashIcon,
  SearchIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  CheckCircle2Icon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/ui/modal"

type EntityType = "all" | "avatar" | "entry_screenshot" | "game_cover" | "hardware_image" | "orphaned"

interface StorageStats {
  configured: boolean
  bucketName: string
  totalObjects: number
  totalSizeBytes: number
  orphanedCount: number
  orphanedSizeBytes: number
  byEntityType: Record<string, { count: number; totalSizeBytes: number }>
}

interface StorageObject {
  id: string
  key: string
  bucket: string
  size: number
  mimeType: string
  entityType: string
  entityId: string | null
  uploadedBy: string
  uploaderName: string | null
  createdAt: string
  lastAccessedAt: string | null
  isOrphaned: boolean
}

interface ObjectsResponse {
  data: StorageObject[]
  total: number
  limit: number
  offset: number
}

const LIMIT = 50

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function entityTypeLabel(type: string) {
  const labels: Record<string, string> = {
    avatar: "Avatar",
    entry_screenshot: "Screenshot",
    game_cover: "Game Cover",
    hardware_image: "Hardware Img",
  }
  return labels[type] ?? type
}

function entityTypeBadgeClass(type: string) {
  const classes: Record<string, string> = {
    avatar: "bg-purple-500/10 text-purple-400",
    entry_screenshot: "bg-blue-500/10 text-blue-400",
    game_cover: "bg-green-500/10 text-green-400",
    hardware_image: "bg-amber-500/10 text-amber-400",
  }
  return classes[type] ?? "bg-text/5 text-text/50"
}

export function StorageClient() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [objects, setObjects] = useState<StorageObject[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [entityFilter, setEntityFilter] = useState<EntityType>("all")
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<StorageObject | null>(null)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; errors: number } | null>(null)

  const isSearchChangeRef = useRef(false)

  useEffect(() => {
    setStatsLoading(true)
    fetch("/api/admin/storage/stats")
      .then((res) => res.json())
      .then((data) => {
        setStats(data)
        setStatsLoading(false)
      })
      .catch(() => setStatsLoading(false))
  }, [])

  useEffect(() => {
    const delay = isSearchChangeRef.current ? 300 : 0
    isSearchChangeRef.current = false

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(offset),
        })
        if (entityFilter === "orphaned") {
          params.set("orphaned", "true")
        } else if (entityFilter !== "all") {
          params.set("entityType", entityFilter)
        }
        if (search.trim()) {
          params.set("search", search.trim())
        }

        const res = await fetch(`/api/admin/storage/objects?${params.toString()}`)
        if (res.ok && !cancelled) {
          const json = (await res.json()) as ObjectsResponse
          setObjects(json.data)
          setTotal(json.total)
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, offset, entityFilter])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setOffset(0)
    isSearchChangeRef.current = true
  }

  const handleDelete = async (obj: StorageObject) => {
    setDeleting(obj.id)
    try {
      const res = await fetch(`/api/admin/storage/objects/${obj.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setObjects((prev) => prev.filter((o) => o.id !== obj.id))
        setTotal((prev) => Math.max(0, prev - 1))
        setConfirmDelete(null)
        const statsRes = await fetch("/api/admin/storage/stats")
        if (statsRes.ok) {
          setStats(await statsRes.json())
        }
      }
    } finally {
      setDeleting(null)
    }
  }

  const handleCleanup = async () => {
    setCleanupLoading(true)
    setCleanupResult(null)
    try {
      const res = await fetch("/api/admin/storage/cleanup", { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setCleanupResult({ deleted: data.deleted, errors: data.errors })
        const statsRes = await fetch("/api/admin/storage/stats")
        if (statsRes.ok) setStats(await statsRes.json())
        setOffset(0)
      }
    } finally {
      setCleanupLoading(false)
    }
  }

  const hasMore = offset + objects.length < total

  const filterTabs: { label: string; value: EntityType }[] = [
    { label: "All", value: "all" },
    { label: "Avatars", value: "avatar" },
    { label: "Screenshots", value: "entry_screenshot" },
    { label: "Covers", value: "game_cover" },
    { label: "Hardware", value: "hardware_image" },
    { label: "Orphaned", value: "orphaned" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HardDriveIcon className="h-5 w-5 text-text/70" />
        <h1 className="text-lg font-semibold text-text">Storage</h1>
      </div>

      {stats && !stats.configured && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
          <AlertTriangleIcon className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-400">R2 Not Configured</p>
            <p className="text-xs text-text/60 mt-1">
              Set the R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PUBLIC_URL environment variables to enable storage management.
            </p>
          </div>
        </div>
      )}

      {statsLoading ? (
        <div className="animate-pulse h-20 rounded-lg bg-zinc-800" />
      ) : stats && stats.configured ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileIcon className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-zinc-500">Total Objects</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalObjects.toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDriveIcon className="h-4 w-4 text-green-400" />
              <span className="text-xs text-zinc-500">Total Size</span>
            </div>
            <p className="text-2xl font-bold">{formatBytes(stats.totalSizeBytes)}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangleIcon className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-zinc-500">Orphaned</span>
            </div>
            <p className="text-2xl font-bold">{stats.orphanedCount.toLocaleString()}</p>
            {stats.orphanedSizeBytes > 0 && (
              <p className="text-xs text-zinc-500">{formatBytes(stats.orphanedSizeBytes)}</p>
            )}
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDriveIcon className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-zinc-500">Bucket</span>
            </div>
            <p className="text-sm font-mono text-text truncate">{stats.bucketName}</p>
          </div>
        </div>
      ) : null}

      {stats?.byEntityType && Object.keys(stats.byEntityType).length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 font-semibold text-sm">Storage by Type</h3>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(stats.byEntityType).map(([type, data]) => (
              <div key={type} className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${entityTypeBadgeClass(type)}`}>
                  {entityTypeLabel(type)}
                </span>
                <span className="text-xs text-text/70">{data.count} · {formatBytes(data.totalSizeBytes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats?.configured && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanup}
            disabled={cleanupLoading || !stats?.configured}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cleanupLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
            Run Orphan Cleanup
          </button>
          {cleanupResult && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2Icon className="h-4 w-4 text-green-400" />
              <span className="text-text/70">
                Deleted {cleanupResult.deleted} objects
                {cleanupResult.errors > 0 && `, ${cleanupResult.errors} errors`}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by key..."
          className="w-full pl-9 pr-4 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setEntityFilter(tab.value)
              setOffset(0)
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              entityFilter === tab.value
                ? "bg-primary/10 text-primary"
                : "bg-text/5 text-text/70 hover:bg-text/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-text/[0.03]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">Key</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">Size</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">Uploaded By</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text/50">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : objects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-text/50">No objects found.</td>
                </tr>
              ) : (
                objects.map((obj) => (
                  <tr
                    key={obj.id}
                    className="border-t border-border hover:bg-text/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-text/70 truncate max-w-[300px]" title={obj.key}>{obj.key}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${entityTypeBadgeClass(obj.entityType)}`}>
                        {entityTypeLabel(obj.entityType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text/70">{formatBytes(obj.size)}</td>
                    <td className="px-4 py-3 text-xs text-text/70">{obj.uploaderName || "System"}</td>
                    <td className="px-4 py-3 text-xs text-text/50">{formatDate(obj.createdAt)}</td>
                    <td className="px-4 py-3">
                      {obj.isOrphaned && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-amber-500/10 text-amber-400">
                          Orphaned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setConfirmDelete(obj)}
                        disabled={deleting === obj.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deleting === obj.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TrashIcon className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {objects.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text/50">
            Showing {offset + 1}–{Math.min(offset + objects.length, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((prev) => Math.max(0, prev - LIMIT))}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              onClick={() => setOffset((prev) => prev + LIMIT)}
              disabled={!hasMore || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              Next
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => handleDelete(confirmDelete)}
          title="Delete Storage Object"
          message={`Are you sure you want to delete "${confirmDelete.key}"? This will remove the file from R2 storage and the database record. This action cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          loading={deleting === confirmDelete.id}
        />
      )}
    </div>
  )
}

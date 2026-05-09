"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Loader2,
  SearchIcon,
  ShieldCheckIcon,
  TrashIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { ConfirmDialog } from "@/components/ui/modal"

interface PerformanceEntry {
  id: string
  versionId: string
  hardwareSlug: string
  userId: string
  fpsAvg: number | null
  fpsLow: number | null
  fpsHigh: number | null
  protonVersion: string | null
  osVersion: string | null
  upscalerType: string | null
  upscalerVersion: string | null
  frameGenMethod: string | null
  loadTimeSsd: number | null
  loadTimeSd: number | null
  launchOptions: string | null
  settingsJson: string | null
  userNotes: string | null
  estimatedBatteryMin: number | null
  customSystem: string | null
  isRemoved: boolean
  removedReason: string | null
  upvotes: number
  downvotes: number
  verifiedAt: string | null
  verifiedBy: string | null
  createdAt: string
  updatedAt: string
  gameId: string
  gameTitle: string
  versionString: string
  hardwareName: string
  authorName: string | null
  authorImage: string | null
}

interface PerformanceApiResponse {
  data: PerformanceEntry[]
  total: number
  limit: number
  offset: number
}

type StatusFilter = "all" | "active" | "removed" | "unverified"

const LIMIT = 20

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getInitial(name: string | null | undefined) {
  return name?.charAt(0)?.toUpperCase() || "?"
}

function statusBadgeClasses(entry: PerformanceEntry) {
  if (entry.verifiedAt) return "bg-green-500/10 text-green-400"
  if (entry.isRemoved) return "bg-red-500/10 text-red-400"
  return "bg-text/5 text-text/50"
}

function statusLabel(entry: PerformanceEntry) {
  if (entry.verifiedAt) return "Verified"
  if (entry.isRemoved) return "Removed"
  return "Active"
}

function statusDotClass(entry: PerformanceEntry) {
  if (entry.verifiedAt) return "bg-green-400"
  if (entry.isRemoved) return "bg-red-400"
  return "bg-text/40"
}

function formatFps(entry: PerformanceEntry) {
  if (entry.fpsAvg == null) return "—"
  if (entry.fpsLow != null && entry.fpsHigh != null) {
    return `${entry.fpsAvg} (${entry.fpsLow}–${entry.fpsHigh})`
  }
  return `${entry.fpsAvg}`
}

export function BenchmarksClient() {
  const [entries, setEntries] = useState<PerformanceEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [confirmAction, setConfirmAction] = useState<
    | { type: "verify" | "remove" | "restore" | "hardDelete"; entry: PerformanceEntry }
    | null
  >(null)
  const [removeReason, setRemoveReason] = useState("")

  const isSearchChangeRef = useRef(false)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setOffset(0)
    isSearchChangeRef.current = true
  }

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value)
    setOffset(0)
    isSearchChangeRef.current = true
  }

  const handlePrev = () => {
    setOffset((prev) => Math.max(0, prev - LIMIT))
    isSearchChangeRef.current = false
  }

  const handleNext = () => {
    setOffset((prev) => prev + LIMIT)
    isSearchChangeRef.current = false
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
      })
      if (statusFilter === "active") {
        params.set("removed", "false")
      } else if (statusFilter === "removed") {
        params.set("removed", "true")
      } else if (statusFilter === "unverified") {
        params.set("verified", "false")
      }
      if (search.trim()) {
        params.set("search", search.trim())
      }

      const res = await fetch(`/api/admin/performance?${params.toString()}`)
      if (res.ok) {
        const json = (await res.json()) as PerformanceApiResponse
        setEntries(json.data)
        setTotal(json.total)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [search, offset, statusFilter])

  useEffect(() => {
    const delay = isSearchChangeRef.current ? 300 : 0
    isSearchChangeRef.current = false

    let cancelled = false
    const timer = setTimeout(async () => {
      if (!cancelled) {
        await loadData()
      }
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [loadData])

  const handleVerify = async (entry: PerformanceEntry) => {
    setActionLoading((prev) => ({ ...prev, [entry.id]: true }))
    try {
      const res = await fetch(`/api/admin/performance/${entry.id}/verify`, {
        method: "PATCH",
      })
      if (res.ok) {
        await loadData()
        setConfirmAction(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  const handleRemove = async (entry: PerformanceEntry) => {
    setActionLoading((prev) => ({ ...prev, [entry.id]: true }))
    try {
      const body: { reason?: string } = {}
      if (removeReason.trim()) {
        body.reason = removeReason.trim()
      }
      const res = await fetch(`/api/admin/performance/${entry.id}/remove`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setRemoveReason("")
        await loadData()
        setConfirmAction(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  const handleHardDelete = async (entry: PerformanceEntry) => {
    setActionLoading((prev) => ({ ...prev, [entry.id]: true }))
    try {
      const res = await fetch(`/api/admin/performance/${entry.id}/hard-delete`, {
        method: "DELETE",
      })
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id))
        setTotal((prev) => Math.max(0, prev - 1))
        setConfirmAction(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  const handleRestore = async (entry: PerformanceEntry) => {
    setActionLoading((prev) => ({ ...prev, [entry.id]: true }))
    try {
      const res = await fetch(`/api/admin/performance/${entry.id}/restore`, {
        method: "PATCH",
      })
      if (res.ok) {
        await loadData()
        setConfirmAction(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [entry.id]: false }))
    }
  }

  const hasMore = offset + entries.length < total

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Removed", value: "removed" },
    { label: "Unverified", value: "unverified" },
  ]

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search benchmarks..."
          className="w-full pl-9 pr-4 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              statusFilter === tab.value
                ? "bg-primary/10 text-primary"
                : "bg-text/5 text-text/70 hover:bg-text/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-text/[0.03]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Game
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Author
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Hardware
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                FPS
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Upscaler
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Votes
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Date
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text/50">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text/50">
                  No benchmarks found.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-border hover:bg-text/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-text truncate max-w-[180px]">
                      {entry.gameTitle}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {entry.authorImage ? (
                        <Image
                          src={entry.authorImage}
                          alt={entry.authorName || "User"}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-text/10 flex items-center justify-center text-xs font-medium text-text/70">
                          {getInitial(entry.authorName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-text truncate">
                          {entry.authorName || "Unknown"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text/70 truncate max-w-[120px]">
                      {entry.hardwareName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text/70">{formatFps(entry)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text/50">
                      {entry.upscalerType || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${statusBadgeClasses(entry)}`}
                    >
                      {entry.verifiedAt ? (
                        <ShieldCheckIcon className="h-3 w-3" />
                      ) : (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${statusDotClass(entry)}`}
                        />
                      )}
                      {statusLabel(entry)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs text-text/70">
                      <span>▲ {entry.upvotes}</span>
                      <span>▼ {entry.downvotes}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text/50">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/game/${entry.gameId}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                        View
                      </Link>
                      {!entry.verifiedAt && (
                        <button
                          onClick={() =>
                            setConfirmAction({ type: "verify", entry })
                          }
                          disabled={actionLoading[entry.id]}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading[entry.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ShieldCheckIcon className="h-3.5 w-3.5" />
                          )}
                          Verify
                        </button>
                      )}
                      {!entry.isRemoved ? (
                        <button
                          onClick={() =>
                            setConfirmAction({ type: "remove", entry })
                          }
                          disabled={actionLoading[entry.id]}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading[entry.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <TrashIcon className="h-3.5 w-3.5" />
                          )}
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setConfirmAction({ type: "restore", entry })
                          }
                          disabled={actionLoading[entry.id]}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading[entry.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCwIcon className="h-3.5 w-3.5" />
                          )}
                          Restore
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmAction({ type: "hardDelete", entry })}
                        disabled={actionLoading[entry.id]}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-600/10 text-red-500 hover:bg-red-600/20 transition-colors cursor-pointer disabled:opacity-50"
                        title="Permanently delete"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Purge
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {entries.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text/50">
            Showing {offset + 1}–{Math.min(offset + entries.length, total)} of{" "}
            {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasMore || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              Next
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialogs */}
      {confirmAction?.type === "verify" && (
        <ConfirmDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleVerify(confirmAction.entry)}
          title="Confirm Verify"
          message="Are you sure you want to verify this benchmark? It will be marked as verified."
          confirmLabel="Verify"
          variant="default"
          loading={actionLoading[confirmAction.entry.id]}
        />
      )}

      {confirmAction?.type === "remove" && (
        <ConfirmDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleRemove(confirmAction.entry)}
          title="Confirm Remove"
          message="Are you sure you want to remove this benchmark?"
          confirmLabel="Remove"
          variant="destructive"
          loading={actionLoading[confirmAction.entry.id]}
        >
          <textarea
            rows={3}
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
            placeholder="Optional reason..."
            className="w-full px-3 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors resize-none"
          />
        </ConfirmDialog>
      )}

      {confirmAction?.type === "restore" && (
        <ConfirmDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleRestore(confirmAction.entry)}
          title="Confirm Restore"
          message="Are you sure you want to restore this benchmark?"
          confirmLabel="Restore"
          variant="default"
          loading={actionLoading[confirmAction.entry.id]}
        />
      )}

      {confirmAction?.type === "hardDelete" && (
        <ConfirmDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleHardDelete(confirmAction.entry)}
          title="⚠️ Permanent Delete"
          message="This will permanently delete this benchmark entry. This action cannot be undone."
          confirmLabel="Delete Forever"
          variant="destructive"
          loading={actionLoading[confirmAction.entry.id]}
        />
      )}
    </div>
  )
}

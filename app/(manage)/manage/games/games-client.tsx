"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import {
  Loader2,
  SearchIcon,
  ExternalLinkIcon,
  TrashIcon,
  Gamepad2Icon,
  RefreshCwIcon,
  CheckCircle2Icon,
  XCircleIcon,
} from "lucide-react"

interface SyncProgress {
  isRunning: boolean
  current: number
  total: number
  currentGame: string | null
  synced: number
  failed: number
  results: Map<string, { success: boolean; error?: string }>
}

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
  source: "steam" | "manual" | "gog" | "epic"
  lastSync: string | null
  syncStatus: string | null
  syncError: string | null
  createdAt: string
  updatedAt: string
}

interface GamesApiResponse {
  data: Game[]
  total: number
  limit: number
  offset: number
}

const LIMIT = 50

export function GamesClient() {
  const [games, setGames] = useState<Game[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [resyncingIds, setResyncingIds] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    isRunning: false,
    current: 0,
    total: 0,
    currentGame: null,
    synced: 0,
    failed: 0,
    results: new Map(),
  })
  const [syncCompleted, setSyncCompleted] = useState(false)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(games.map((g) => g.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleSyncSelected = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const gamesToSync = games.filter((g) => ids.includes(g.id) && g.steamAppId)
    if (gamesToSync.length === 0) {
      alert("No Steam games selected to sync")
      return
    }

    setSyncing(true)
    setSyncCompleted(false)
    setSyncProgress({
      isRunning: true,
      current: 0,
      total: gamesToSync.length,
      currentGame: "Preparing sync...",
      synced: 0,
      failed: 0,
      results: new Map(),
    })

    try {
      // Use the bulk sync endpoint with streaming progress
      const res = await fetch("/api/games/sync/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "selected",
          gameIds: gamesToSync.map((g) => g.id),
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || `Sync failed: HTTP ${res.status}`)
      }

      // Read streaming response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const data = JSON.parse(line)

              if (data.type === "progress") {
                setSyncProgress((prev) => ({
                  ...prev,
                  current: data.current,
                  total: data.total,
                  synced: data.synced,
                  failed: data.failed,
                  currentGame: data.currentGame,
                }))
              } else if (data.type === "complete") {
                setSyncProgress((prev) => ({
                  ...prev,
                  isRunning: false,
                  total: data.total,
                  synced: data.synced,
                  failed: data.failed,
                  currentGame: null,
                }))
                setSyncCompleted(true)
                setSelectedIds(new Set())
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Sync selected failed:", error)
      alert(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
      setSyncProgress((prev) => ({
        ...prev,
        isRunning: false,
        currentGame: null,
      }))
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAll = async () => {
    if (!confirm("This will sync all Steam games. Continue?")) return

    setSyncing(true)
    setSyncCompleted(false)
    setSyncProgress({
      isRunning: true,
      current: 0,
      total: 0,
      currentGame: "Preparing sync...",
      synced: 0,
      failed: 0,
      results: new Map(),
    })

    try {
      // Use the bulk sync endpoint with streaming progress
      const res = await fetch("/api/games/sync/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || `Sync failed: HTTP ${res.status}`)
      }

      // Read streaming response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const data = JSON.parse(line)

              if (data.type === "progress") {
                setSyncProgress((prev) => ({
                  ...prev,
                  current: data.current,
                  total: data.total,
                  synced: data.synced,
                  failed: data.failed,
                  currentGame: data.currentGame,
                }))
              } else if (data.type === "complete") {
                setSyncProgress((prev) => ({
                  ...prev,
                  isRunning: false,
                  total: data.total,
                  synced: data.synced,
                  failed: data.failed,
                  currentGame: null,
                }))
                setSyncCompleted(true)
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Sync all failed:", error)
      alert(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
      setSyncProgress((prev) => ({
        ...prev,
        isRunning: false,
        currentGame: null,
      }))
    } finally {
      setSyncing(false)
    }
  }

  const closeSyncOverlay = () => {
    setSyncCompleted(false)
    setSyncProgress({
      isRunning: false,
      current: 0,
      total: 0,
      currentGame: null,
      synced: 0,
      failed: 0,
      results: new Map(),
    })
  }

  // Close sync overlay on Escape key
  useEffect(() => {
    if (!syncCompleted) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSyncOverlay()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [syncCompleted])

  const isSearchChangeRef = useRef(false)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setOffset(0)
    isSearchChangeRef.current = true
    setSelectedIds(new Set()) // Clear selection on search change
  }

  const handlePrev = () => {
    setOffset((prev) => Math.max(0, prev - LIMIT))
    isSearchChangeRef.current = false
    setSelectedIds(new Set()) // Clear selection on page change
  }

  const handleNext = () => {
    setOffset((prev) => prev + LIMIT)
    isSearchChangeRef.current = false
  }

  useEffect(() => {
    const delay = isSearchChangeRef.current ? 300 : 0
    isSearchChangeRef.current = false

    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/games?limit=${LIMIT}&offset=${offset}&search=${encodeURIComponent(search)}&sort=createdAt&order=desc`
        )
        if (res.ok && !cancelled) {
          const json = (await res.json()) as GamesApiResponse
          setGames(json.data)
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
  }, [search, offset])

  const handleResync = async (game: Game) => {
    setResyncingIds((prev) => new Set(prev).add(game.id))
    try {
      const res = await fetch(`/api/games/${game.id}/sync`, {
        method: "POST",
      })
      if (res.ok) {
        setGames((prev) =>
          prev.map((g) =>
            g.id === game.id
              ? { ...g, syncStatus: "synced", lastSync: new Date().toISOString() }
              : g
          )
        )
      }
    } catch (error) {
      console.error("Resync failed:", error)
    } finally {
      setResyncingIds((prev) => {
        const next = new Set(prev)
        next.delete(game.id)
        return next
      })
    }
  }

  const handleDelete = async (game: Game) => {
    if (!confirm(`Are you sure you want to delete "${game.title}"?`)) return
    setDeletingIds((prev) => new Set(prev).add(game.id))
    try {
      const res = await fetch(`/api/games/${game.id}`, { method: "DELETE" })
      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== game.id))
        setTotal((prev) => Math.max(0, prev - 1))
      }
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(game.id)
        return next
      })
    }
  }

  const hasMore = offset + games.length < total

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search games..."
            className="w-full pl-9 pr-4 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
            Sync All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-text/[0.03]">
            <tr>
              <th className="text-left px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === games.length && games.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-border"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50 w-14">
                Cover
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Title
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Developer
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Source
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Sync
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text/50">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : games.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text/50">
                  No games found.
                </td>
              </tr>
            ) : (
              games.map((game) => (
                <tr
                  key={game.id}
                  className="border-t border-border hover:bg-text/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(game.id)}
                      onChange={(e) => handleSelectOne(game.id, e.target.checked)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-10 w-10 rounded overflow-hidden bg-text/5 flex items-center justify-center">
                      {game.capsuleImage || game.headerImage ? (
                        <Image
                          src={game.capsuleImage || game.headerImage || ""}
                          alt={game.title}
                          width={40}
                          height={40}
                          className="h-10 w-10 object-cover"
                          unoptimized
                        />
                      ) : (
                        <Gamepad2Icon className="h-4 w-4 text-text/40" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text truncate max-w-[200px]">
                      {game.title}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text/50 truncate max-w-[150px]">
                      {game.developer || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                        game.source === "steam"
                          ? "bg-blue-500/10 text-blue-400"
                          : game.source === "manual"
                            ? "bg-text/5 text-text/50"
                            : "bg-text/5 text-text/50"
                      }`}
                    >
                      {game.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                        game.syncStatus === "synced"
                          ? "bg-green-500/10 text-green-400"
                          : game.syncStatus === "failed"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-yellow-500/10 text-yellow-400"
                      }`}
                      title={game.syncStatus === "failed" ? game.syncError || undefined : undefined}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          game.syncStatus === "synced"
                            ? "bg-green-400"
                            : game.syncStatus === "failed"
                              ? "bg-red-400"
                              : "bg-yellow-400"
                        }`}
                      />
                      {game.syncStatus === "synced" ? "Synced" : game.syncStatus === "failed" ? "Failed" : "Stale"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/game/${game.id}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                        View
                      </Link>
                      <button
                        onClick={() => handleResync(game)}
                        disabled={resyncingIds.has(game.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {resyncingIds.has(game.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCwIcon className="h-3.5 w-3.5" />
                        )}
                        Resync
                      </button>
                      <button
                        onClick={() => handleDelete(game)}
                        disabled={deletingIds.has(game.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {deletingIds.has(game.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TrashIcon className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sync Progress Overlay — portaled to body for guaranteed viewport coverage */}
      {(syncProgress.isRunning || syncCompleted) &&
        createPortal(
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sync-overlay-title"
              className="w-full max-w-md mx-4 p-6 bg-background border border-border rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              {syncProgress.isRunning ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCwIcon className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <div>
                      <h3 id="sync-overlay-title" className="font-semibold text-text">Syncing Games</h3>
                      <p className="text-sm text-text/50">
                        {syncProgress.total > 0
                          ? `${syncProgress.current} of ${syncProgress.total} games`
                          : "Preparing to sync..."
                        }
                      </p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-text/50 mb-1">
                      <span>Progress</span>
                      <span>{syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-text/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 ease-out"
                        style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Current game */}
                  {syncProgress.currentGame && (
                    <div className="mb-4 p-3 bg-text/5 rounded-lg">
                      <p className="text-xs text-text/50 mb-1">Currently syncing:</p>
                      <p className="text-sm font-medium text-text truncate">{syncProgress.currentGame}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Completed state header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2Icon className="h-8 w-8 text-green-400" />
                      <div>
                        <h3 id="sync-overlay-title" className="font-semibold text-text">Sync Complete</h3>
                        <p className="text-sm text-text/50">
                          {syncProgress.synced} synced, {syncProgress.failed} failed
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={closeSyncOverlay}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}

              {/* Stats — shown in both running and completed states */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1 p-3 bg-green-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2Icon className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-400">{syncProgress.synced}</span>
                  </div>
                  <p className="text-xs text-text/50 mt-1">Synced</p>
                </div>
                <div className="flex-1 p-3 bg-red-500/10 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircleIcon className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium text-red-400">{syncProgress.failed}</span>
                  </div>
                  <p className="text-xs text-text/50 mt-1">Failed</p>
                </div>
              </div>

              {/* Results list — scrollable */}
              {syncProgress.results.size > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  <p className="text-xs text-text/50 mb-2">
                    {syncCompleted ? "All results:" : "Recent results:"}
                  </p>
                  {(syncCompleted
                    ? Array.from(syncProgress.results.entries())
                    : Array.from(syncProgress.results.entries()).slice(-5).reverse()
                  ).map(([gameId, result]) => {
                    const game = games.find((g) => g.id === gameId)
                    return (
                      <div key={gameId} className="flex items-center gap-2 py-1">
                        {result.success ? (
                          <CheckCircle2Icon className="h-3 w-3 text-green-400 shrink-0" />
                        ) : (
                          <XCircleIcon className="h-3 w-3 text-red-400 shrink-0" />
                        )}
                        <span className="text-xs text-text/70 truncate">
                          {game?.title || gameId}
                        </span>
                        {!result.success && result.error && (
                          <span className="text-xs text-red-400/70 ml-auto shrink-0 truncate max-w-[150px]" title={result.error}>
                            {result.error}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Floating action bar */}
      {selectedIds.size > 0 && !syncProgress.isRunning && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl shadow-lg">
          <span className="text-sm text-text/70">
            {selectedIds.size} game{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleSyncSelected}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Resync Selected
          </button>
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-text/5 text-text hover:bg-text/10 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Resync All
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-2 rounded-lg text-sm text-text/50 hover:text-text/70 transition-colors cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Pagination */}
      {games.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text/50">
            Showing {offset + 1}–{Math.min(offset + games.length, total)} of{" "}
            {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasMore || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

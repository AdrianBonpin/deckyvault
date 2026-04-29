"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Loader2,
  SearchIcon,
  ExternalLinkIcon,
  TrashIcon,
  Gamepad2Icon,
  RefreshCwIcon,
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

    setSyncing(true)
    try {
      const res = await fetch("/api/games/sync/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds: ids, mode: "selected" }),
      })

      if (res.ok) {
        const data = await res.json()
        alert(data.message)
        setSelectedIds(new Set())
        // Refresh games list
        const refreshRes = await fetch(
          `/api/games?limit=${LIMIT}&offset=${offset}&search=${encodeURIComponent(search)}`
        )
        if (refreshRes.ok) {
          const json = await refreshRes.json()
          setGames(json.data)
          setTotal(json.total)
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
        alert(`Sync failed: ${errorData.error || res.statusText}`)
      }
    } catch (error) {
      console.error("Bulk sync failed:", error)
      alert("Sync failed. Check console for details.")
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAll = async () => {
    if (!confirm("This will sync all Steam games. Continue?")) return

    setSyncing(true)
    try {
      const res = await fetch("/api/games/sync/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "all" }),
      })

      if (res.ok) {
        const data = await res.json()
        alert(data.message)
        setSelectedIds(new Set())
        // Refresh games list
        const refreshRes = await fetch(
          `/api/games?limit=${LIMIT}&offset=${offset}&search=${encodeURIComponent(search)}`
        )
        if (refreshRes.ok) {
          const json = await refreshRes.json()
          setGames(json.data)
          setTotal(json.total)
        }
      } else {
        const errorData = await res.json().catch(() => ({ error: "Unknown error" }))
        alert(`Sync failed: ${errorData.error || res.statusText}`)
      }
    } catch (error) {
      console.error("Sync all failed:", error)
      alert("Sync failed. Check console for details.")
    } finally {
      setSyncing(false)
    }
  }

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
          `/api/games?limit=${LIMIT}&offset=${offset}&search=${encodeURIComponent(search)}`
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

      {/* Floating action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-background border border-border rounded-xl shadow-lg">
          <span className="text-sm text-text/70">
            {selectedIds.size} game{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <button
            onClick={handleSyncSelected}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="h-4 w-4" />
            )}
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

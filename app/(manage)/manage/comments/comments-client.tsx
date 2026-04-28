"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Loader2,
  SearchIcon,
  TrashIcon,
  RotateCcwIcon,
  ExternalLinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageSquareIcon,
} from "lucide-react"

interface Comment {
  id: string
  gameId: string
  content: Record<string, unknown>
  upvotes: number
  isRemoved: boolean
  createdAt: string
  updatedAt: string
  userId: string
  userName: string | null
  userImage: string | null
  gameTitle: string
  parentId: string | null
}

interface CommentsApiResponse {
  data: Comment[]
  total: number
  limit: number
  offset: number
}

type StatusFilter = "all" | "active" | "removed"

const LIMIT = 20

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getInitial(name: string | null | undefined) {
  return name?.charAt(0)?.toUpperCase() || "?"
}

function extractPlainText(content: Record<string, unknown>, maxLength = 80): string {
  let result = ""
  function walk(node: unknown) {
    if (typeof node !== "object" || node === null) return
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
        if (result.length >= maxLength) return
      }
      return
    }
    const obj = node as Record<string, unknown>
    if (typeof obj.text === "string") {
      result += obj.text
      if (result.length >= maxLength) return
    }
    if (Array.isArray(obj.content)) {
      for (const item of obj.content) {
        walk(item)
        if (result.length >= maxLength) return
      }
    }
  }
  walk(content)
  return result.length > maxLength ? result.slice(0, maxLength) + "…" : result
}

function statusBadgeClasses(isRemoved: boolean) {
  return isRemoved
    ? "bg-red-500/10 text-red-400"
    : "bg-green-500/10 text-green-400"
}

function statusDotClass(isRemoved: boolean) {
  return isRemoved ? "bg-red-400" : "bg-green-400"
}

export function CommentsClient() {
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [confirmAction, setConfirmAction] = useState<
    | { type: "remove" | "restore"; comment: Comment }
    | null
  >(null)

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
      }
      if (search.trim()) {
        params.set("search", search.trim())
      }

      const res = await fetch(`/api/admin/comments?${params.toString()}`)
      if (res.ok) {
        const json = (await res.json()) as CommentsApiResponse
        setComments(json.data)
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

  const handleRemove = async (comment: Comment) => {
    setActionLoading((prev) => ({ ...prev, [comment.id]: true }))
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}/remove`, {
        method: "PATCH",
      })
      if (res.ok) {
        await loadData()
        setConfirmAction(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [comment.id]: false }))
    }
  }

  const handleRestore = async (comment: Comment) => {
    setActionLoading((prev) => ({ ...prev, [comment.id]: true }))
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}/restore`, {
        method: "PATCH",
      })
      if (res.ok) {
        await loadData()
        setConfirmAction(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [comment.id]: false }))
    }
  }

  const hasMore = offset + comments.length < total

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Removed", value: "removed" },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MessageSquareIcon className="h-5 w-5 text-text/70" />
        <h1 className="text-lg font-semibold text-text">Comments</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search comments..."
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
        <table className="w-full text-sm">
          <thead className="bg-text/[0.03]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Author
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Content
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Game
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Upvotes
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Status
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
                <td colSpan={7} className="px-4 py-8 text-center text-text/50">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : comments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text/50">
                  No comments found.
                </td>
              </tr>
            ) : (
              comments.map((comment) => (
                <tr
                  key={comment.id}
                  className="border-t border-border hover:bg-text/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {comment.userImage ? (
                        <Image
                          src={comment.userImage}
                          alt={comment.userName || "User"}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-text/10 flex items-center justify-center text-xs font-medium text-text/70">
                          {getInitial(comment.userName)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-text truncate">
                          {comment.userName || "Unknown"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text/70 truncate max-w-[240px]">
                      {extractPlainText(comment.content, 80)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text truncate max-w-[150px]">
                      {comment.gameTitle}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text/70">{comment.upvotes}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${statusBadgeClasses(comment.isRemoved)}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${statusDotClass(comment.isRemoved)}`}
                      />
                      {comment.isRemoved ? "Removed" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text/50">
                    {formatDate(comment.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/game/${comment.gameId}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                        View
                      </Link>
                      {!comment.isRemoved ? (
                        <button
                          onClick={() =>
                            setConfirmAction({ type: "remove", comment })
                          }
                          disabled={actionLoading[comment.id]}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading[comment.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <TrashIcon className="h-3.5 w-3.5" />
                          )}
                          Remove
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setConfirmAction({ type: "restore", comment })
                          }
                          disabled={actionLoading[comment.id]}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {actionLoading[comment.id] ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcwIcon className="h-3.5 w-3.5" />
                          )}
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {comments.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text/50">
            Showing {offset + 1}–{Math.min(offset + comments.length, total)} of{" "}
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
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            {confirmAction.type === "remove" && (
              <>
                <h2 className="text-base font-semibold text-text">
                  Confirm Remove
                </h2>
                <p className="text-sm text-text/70">
                  Are you sure you want to remove this comment?
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRemove(confirmAction.comment)}
                    disabled={actionLoading[confirmAction.comment.id]}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {actionLoading[confirmAction.comment.id] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <TrashIcon className="h-3.5 w-3.5" />
                    )}
                    Remove
                  </button>
                </div>
              </>
            )}

            {confirmAction.type === "restore" && (
              <>
                <h2 className="text-base font-semibold text-text">
                  Confirm Restore
                </h2>
                <p className="text-sm text-text/70">
                  Are you sure you want to restore this comment?
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRestore(confirmAction.comment)}
                    disabled={actionLoading[confirmAction.comment.id]}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {actionLoading[confirmAction.comment.id] ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcwIcon className="h-3.5 w-3.5" />
                    )}
                    Restore
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

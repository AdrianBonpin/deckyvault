"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ConfirmDialog } from "@/components/ui/modal"
import {
  Loader2,
  SearchIcon,
  Lightbulb,
  ExternalLinkIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

interface Suggestion {
  id: string
  gameId: string
  gameTitle: string
  fieldName: string
  currentValue: string | null
  proposedValue: string
  reason: string | null
  status: string
  createdAt: string
  userName: string | null
}

type ConfirmType = "approve" | "reject"

interface SuggestionsApiResponse {
  data: Suggestion[]
  total: number
  limit: number
  offset: number
}

const LIMIT = 50

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function SuggestionsClient() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [confirmAction, setConfirmAction] = useState<{
    type: ConfirmType
    suggestion: Suggestion
  } | null>(null)
  const [activeTab, setActiveTab] = useState("all")

  const statusTabs = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ]

  const fetchSuggestions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/community-suggestions/admin?limit=${LIMIT}`)
      if (res.ok) {
        const json = (await res.json()) as SuggestionsApiResponse
        setSuggestions(json.data)
        setTotal(json.total)
      }
      setOffset(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const filtered = useMemo(() => {
    let result = suggestions
    const term = search.trim().toLowerCase()
    if (term) {
      result = result.filter(
        (s) =>
          s.gameTitle?.toLowerCase().includes(term) ||
          s.fieldName?.toLowerCase().includes(term) ||
          s.proposedValue?.toLowerCase().includes(term) ||
          s.userName?.toLowerCase().includes(term) ||
          s.reason?.toLowerCase().includes(term)
      )
    }
    if (activeTab !== "all") {
      result = result.filter((s) => s.status === activeTab)
    }
    return result
  }, [suggestions, search, activeTab])

  const paginated = filtered.slice(offset, offset + LIMIT)
  const hasMore = offset + LIMIT < total

  const handlePrev = () => setOffset((prev) => Math.max(0, prev - LIMIT))
  const handleNext = () => setOffset((prev) => prev + LIMIT)

  const handleReview = async (
    suggestion: Suggestion,
    status: "approved" | "rejected"
  ) => {
    setActionLoading((prev) => ({ ...prev, [suggestion.id]: true }))
    try {
      const res = await fetch(
        `/api/community-suggestions/${suggestion.id}/review`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      )
      if (res.ok) {
        setSuggestions((prev) =>
          prev.filter((s) => s.id !== suggestion.id)
        )
        setConfirmAction(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [suggestion.id]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-text/50" />
        <h2 className="text-lg font-semibold text-text">Suggestions</h2>
        <span className="text-sm text-text/50">({filtered.length})</span>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search suggestions..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === tab.value
                ? "bg-primary/10 text-primary"
                : "bg-text/5 text-text/60 hover:bg-text/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text/50">
          <Lightbulb className="h-8 w-8 mb-2" />
          <p className="text-sm">No suggestions found</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-text/[0.03]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Game
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Field
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Current
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Proposed
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Reason
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  By
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((suggestion) => (
                <tr
                  key={suggestion.id}
                  className="border-t border-border hover:bg-text/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-text truncate max-w-[200px]">
                      {suggestion.gameTitle}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-text/5 text-text/70">
                      {suggestion.fieldName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text/50 truncate max-w-[150px]">
                      {suggestion.currentValue || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text truncate max-w-[150px]">
                      {suggestion.proposedValue}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text/50 truncate max-w-[200px]">
                      {suggestion.reason || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text/70 truncate max-w-[120px]">
                      {suggestion.userName || "Unknown"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-text/50">
                      {formatDate(suggestion.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                        suggestion.status === "approved"
                          ? "bg-green-500/10 text-green-400"
                          : suggestion.status === "rejected"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          suggestion.status === "approved"
                            ? "bg-green-400"
                            : suggestion.status === "rejected"
                            ? "bg-red-400"
                            : "bg-yellow-400"
                        }`}
                      />
                      {suggestion.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/game/${suggestion.gameId}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors cursor-pointer"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                        View
                      </Link>
                      <button
                        onClick={() =>
                          setConfirmAction({ type: "approve", suggestion })
                        }
                        disabled={actionLoading[suggestion.id]}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading[suggestion.id] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2Icon className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() =>
                          setConfirmAction({ type: "reject", suggestion })
                        }
                        disabled={actionLoading[suggestion.id]}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {actionLoading[suggestion.id] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircleIcon className="h-3.5 w-3.5" />
                        )}
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text/50">
            Showing {offset + 1}–{Math.min(offset + paginated.length, total)} of{" "}
            {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasMore || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            handleReview(
              confirmAction.suggestion,
              confirmAction.type === "approve" ? "approved" : "rejected"
            )
          }
        }}
        title={`Confirm ${confirmAction?.type === "approve" ? "Approval" : "Rejection"}`}
        message={
          confirmAction
            ? `Are you sure you want to ${confirmAction.type === "approve" ? "approve" : "reject"} the "${confirmAction.suggestion.fieldName}" suggestion for "${confirmAction.suggestion.gameTitle}"?`
            : ""
        }
        confirmLabel={confirmAction?.type === "approve" ? "Approve" : "Reject"}
        cancelLabel="Cancel"
        variant={confirmAction?.type === "approve" ? "default" : "destructive"}
        loading={confirmAction ? !!actionLoading[confirmAction.suggestion.id] : false}
      />
    </div>
  )
}

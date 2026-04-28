"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  Loader2,
  SearchIcon,
  ShieldCheckIcon,
  XIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FlagIcon,
} from "lucide-react"

interface Report {
  id: string
  entryId: string
  reporterId: string
  reporterName: string | null
  reason: "inaccurate" | "spam" | "inappropriate" | "other"
  details: string | null
  status: "open" | "reviewed" | "dismissed"
  createdAt: string
  entry: {
    id: string
    userId: string
    fpsAvg: number | null
    fpsLow: number | null
    fpsHigh: number | null
    upscalerType: string | null
    userNotes: string | null
    isRemoved: boolean
    authorName: string | null
  }
  gameVersion: {
    id: string
    versionString: string
  }
  game: {
    id: string
    title: string
    headerImage: string | null
  }
}

interface ReportsApiResponse {
  data: Report[]
  total: number
  limit: number
  offset: number
}

type StatusFilter = "all" | "open" | "reviewed" | "dismissed"

const LIMIT = 20

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getInitial(name: string | null | undefined) {
  return name?.charAt(0)?.toUpperCase() || "?"
}

function truncate(str: string | null | undefined, maxLen = 60) {
  if (!str) return "—"
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str
}

function statusBadgeClasses(status: Report["status"]) {
  switch (status) {
    case "open":
      return "bg-yellow-500/10 text-yellow-400"
    case "reviewed":
      return "bg-green-500/10 text-green-400"
    case "dismissed":
      return "bg-text/5 text-text/50"
  }
}

function reasonBadgeClasses(reason: Report["reason"]) {
  switch (reason) {
    case "inaccurate":
      return "bg-blue-500/10 text-blue-400"
    case "spam":
      return "bg-red-500/10 text-red-400"
    case "inappropriate":
      return "bg-orange-500/10 text-orange-400"
    case "other":
      return "bg-text/5 text-text/50"
  }
}

export function ReportsClient() {
  const [reports, setReports] = useState<Report[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [confirmReport, setConfirmReport] = useState<Report | null>(null)

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
        if (statusFilter !== "all") {
          params.set("status", statusFilter)
        }

        const res = await fetch(`/api/admin/reports?${params.toString()}`)
        if (res.ok && !cancelled) {
          const json = (await res.json()) as ReportsApiResponse
          setReports(json.data)
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
  }, [search, offset, statusFilter])

  const handleUpdateStatus = async (report: Report, status: "reviewed" | "dismissed") => {
    setActionLoading((prev) => ({ ...prev, [report.id]: true }))
    try {
      const res = await fetch(`/api/admin/reports/${report.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (res.ok) {
        // Refresh list after action
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(offset),
        })
        if (statusFilter !== "all") {
          params.set("status", statusFilter)
        }

        const listRes = await fetch(`/api/admin/reports?${params.toString()}`)
        if (listRes.ok) {
          const json = (await listRes.json()) as ReportsApiResponse
          setReports(json.data)
          setTotal(json.total)
        }
        setConfirmReport(null)
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [report.id]: false }))
    }
  }

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return reports
    return reports.filter(
      (r) =>
        r.reporterName?.toLowerCase().includes(term) ||
        r.game.title.toLowerCase().includes(term) ||
        r.reason.toLowerCase().includes(term) ||
        r.details?.toLowerCase().includes(term) ||
        r.status.toLowerCase().includes(term)
    )
  }, [reports, search])

  const hasMore = offset + filteredReports.length < total

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: "All", value: "all" },
    { label: "Open", value: "open" },
    { label: "Reviewed", value: "reviewed" },
    { label: "Dismissed", value: "dismissed" },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlagIcon className="h-5 w-5 text-text/70" />
        <h1 className="text-lg font-semibold text-text">Reports</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search reports..."
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
                Reporter
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Game
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                FPS
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Reason
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Details
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
                <td colSpan={8} className="px-4 py-8 text-center text-text/50">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filteredReports.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text/50">
                  No reports found.
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr
                  key={report.id}
                  className="border-t border-border hover:bg-text/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-text/10 flex items-center justify-center text-xs font-medium text-text/70">
                        {getInitial(report.reporterName)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-text truncate">
                          {report.reporterName || "Unknown"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {report.game.headerImage ? (
                        <Image
                          src={report.game.headerImage}
                          alt={report.game.title}
                          width={40}
                          height={20}
                          className="h-5 w-10 object-cover rounded"
                          unoptimized
                        />
                      ) : null}
                      <p className="font-medium text-text truncate max-w-[150px]">
                        {report.game.title}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-text/70">
                      {report.entry.fpsAvg ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${reasonBadgeClasses(report.reason)}`}
                    >
                      {report.reason}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-text/50 truncate max-w-[200px]">
                      {truncate(report.details, 80)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${statusBadgeClasses(report.status)}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          report.status === "open"
                            ? "bg-yellow-400"
                            : report.status === "reviewed"
                              ? "bg-green-400"
                              : "bg-text/40"
                        }`}
                      />
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text/50">
                    {formatDate(report.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {report.status === "open" ? (
                        <>
                          <button
                            onClick={() => setConfirmReport(report)}
                            disabled={actionLoading[report.id]}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading[report.id] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldCheckIcon className="h-3.5 w-3.5" />
                            )}
                            Review
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(report, "dismissed")}
                            disabled={actionLoading[report.id]}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text/70 hover:bg-text/10 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading[report.id] ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XIcon className="h-3.5 w-3.5" />
                            )}
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${statusBadgeClasses(report.status)}`}
                        >
                          {report.status}
                        </span>
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
      {filteredReports.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text/50">
            Showing {offset + 1}–{Math.min(offset + filteredReports.length, total)} of{" "}
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

      {/* Confirmation Dialog */}
      {confirmReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-base font-semibold text-text">Confirm Review</h2>
            <p className="text-sm text-text/70">
              This will also remove the reported benchmark. Are you sure?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmReport(null)}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-text/5 text-text hover:bg-text/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateStatus(confirmReport, "reviewed")}
                disabled={actionLoading[confirmReport.id]}
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading[confirmReport.id] ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                )}
                Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

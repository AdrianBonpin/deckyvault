"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { Loader2, SearchIcon, BanIcon, UserCheckIcon, UsersIcon } from "lucide-react"

type Role = "user" | "contributor" | "admin"

interface AdminUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  createdAt: Date | string
  role: Role
  banned: boolean
}

const roles: Role[] = ["user", "contributor", "admin"]

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getInitial(name: string) {
  return name?.charAt(0)?.toUpperCase() || "?"
}

export function UsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      const res = await authClient.admin.listUsers({ query: { limit: 100 } })
      if (res.data?.users) {
        setUsers(res.data.users as AdminUser[])
      }
      setLoading(false)
    }
    fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return users
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
    )
  }, [users, search])

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      await authClient.admin.setRole({ userId, role: newRole as "user" | "admin" })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      )
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const handleBan = async (userId: string) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      await authClient.admin.banUser({ userId })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, banned: true } : u))
      )
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  const handleUnban = async (userId: string) => {
    setActionLoading((prev) => ({ ...prev, [userId]: true }))
    try {
      await authClient.admin.unbanUser({ userId })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, banned: false } : u))
      )
    } finally {
      setActionLoading((prev) => ({ ...prev, [userId]: false }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-5 w-5 text-text/50" />
          <h2 className="text-lg font-semibold">Users</h2>
          <span className="text-sm text-text/50">({filteredUsers.length})</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text/50">
          <UsersIcon className="h-8 w-8 mb-2" />
          <p className="text-sm">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-text/[0.02] hover:bg-text/[0.04] transition-colors"
            >
              {/* Avatar */}
              {user.image ? (
                <Image
                  src={user.image}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-text/10 flex items-center justify-center text-sm font-medium text-text/70">
                  {getInitial(user.name)}
                </div>
              )}

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-text truncate">{user.name || "Unnamed"}</p>
                  {user.banned && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
                      Banned
                    </span>
                  )}
                </div>
                <p className="text-xs text-text/50 truncate">{user.email}</p>
                <p className="text-[11px] text-text/30 mt-0.5">Joined {formatDate(user.createdAt)}</p>
              </div>

              {/* Role Selector */}
              <select
                value={user.role || "user"}
                onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                disabled={actionLoading[user.id]}
                className="text-xs px-3 py-1.5 rounded-lg border border-border bg-text/5 text-text focus:outline-none focus:border-primary/60 transition-colors cursor-pointer disabled:opacity-50"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
              </select>

              {/* Action Button */}
              {actionLoading[user.id] ? (
                <Loader2 className="h-4 w-4 animate-spin text-text/50" />
              ) : user.banned ? (
                <button
                  onClick={() => handleUnban(user.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
                >
                  <UserCheckIcon className="h-3.5 w-3.5" />
                  Unban
                </button>
              ) : (
                <button
                  onClick={() => handleBan(user.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                >
                  <BanIcon className="h-3.5 w-3.5" />
                  Ban
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

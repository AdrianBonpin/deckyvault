"use client"

import { useEffect, useMemo, useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Loader2, SearchIcon, BanIcon, UserCheckIcon } from "lucide-react"

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
      await authClient.admin.setRole({ userId, role: newRole })
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
      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-9 pr-4 py-2 rounded-md bg-text/5 border border-border text-sm text-text placeholder:text-text/40 focus:outline-none focus:border-primary/60 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-text/[0.03]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                User
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Joined
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-text/50">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text/50">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text/50">
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-border hover:bg-text/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.image ? (
                        <img
                          src={user.image}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-text/10 flex items-center justify-center text-xs font-medium text-text/70">
                          {getInitial(user.name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-text truncate">
                          {user.name || "Unnamed"}
                        </p>
                        <p className="text-xs text-text/50 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role || "user"}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value as Role)
                      }
                      disabled={actionLoading[user.id]}
                      className="text-xs px-2 py-1 rounded-full border border-border bg-text/5 text-text focus:outline-none focus:border-primary/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${user.banned ? "bg-red-500" : "bg-green-500"}`}
                      />
                      <span className="text-xs text-text/70">
                        {user.banned ? "Banned" : "Active"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-text/50">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {actionLoading[user.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin text-text/50" />
                    ) : user.banned ? (
                      <button
                        onClick={() => handleUnban(user.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors cursor-pointer"
                      >
                        <UserCheckIcon className="h-3.5 w-3.5" />
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBan(user.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                      >
                        <BanIcon className="h-3.5 w-3.5" />
                        Ban
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

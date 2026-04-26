"use client"

import { useState, useEffect, useCallback } from "react"
import { authClient } from "@/lib/auth-client"
import { Loader2, Key, Fingerprint, Plus, Trash2, Pencil, Check, X, Shield } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface Passkey {
  id: string
  name: string | null
  deviceType: string
  createdAt: string | null
}

interface AuthMethods {
  hasPassword: boolean
  passkeyCount: number
  oauthProviders: Array<{ providerId: string; id: string }>
  totalAuthMethods: number
}

export function SettingsSecurityTab() {
  const [authMethods, setAuthMethods] = useState<AuthMethods | null>(null)
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [isLoadingAuthMethods, setIsLoadingAuthMethods] = useState(true)
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true)
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Passkey editing state
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isUpdatingPasskey, setIsUpdatingPasskey] = useState(false)
  const [isDeletingPasskey, setIsDeletingPasskey] = useState<string | null>(null)
  const [isAddingPasskey, setIsAddingPasskey] = useState(false)

  const fetchAuthMethods = useCallback(async () => {
    try {
      const res = await fetch("/api/user/me/auth-methods", {
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json()
        setAuthMethods(data)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingAuthMethods(false)
    }
  }, [])

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/passkey/list-user-passkeys", {
        credentials: "include",
      })
      if (res.ok) {
        const data = await res.json()
        setPasskeys(Array.isArray(data) ? data : [])
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingPasskeys(false)
    }
  }, [])

  useEffect(() => {
    fetchAuthMethods()
    fetchPasskeys()
  }, [fetchAuthMethods, fetchPasskeys])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" })
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "Password must be at least 8 characters" })
      return
    }

    setIsPasswordSubmitting(true)

    if (authMethods?.hasPassword) {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
      })

      if (error) {
        setPasswordMessage({ type: "error", text: error.message || "Failed to change password" })
      } else {
        setPasswordMessage({ type: "success", text: "Password changed successfully" })
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } else {
      const res = await fetch("/api/user/me/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
        credentials: "include",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to set password" }))
        setPasswordMessage({ type: "error", text: data.error || "Failed to set password" })
      } else {
        setPasswordMessage({ type: "success", text: "Password set successfully" })
        setNewPassword("")
        setConfirmPassword("")
        await fetchAuthMethods()
      }
    }

    setIsPasswordSubmitting(false)
  }

  const handleAddPasskey = async () => {
    setIsAddingPasskey(true)
    try {
      const { error } = await authClient.passkey.addPasskey()
      if (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to add passkey:", error)
      } else {
        await fetchPasskeys()
        await fetchAuthMethods()
      }
    } catch {
      // silently fail
    } finally {
      setIsAddingPasskey(false)
    }
  }

  const handleDeletePasskey = async (id: string) => {
    if (authMethods && authMethods.totalAuthMethods <= 1) return

    setIsDeletingPasskey(id)
    try {
      const res = await fetch("/api/auth/passkey/delete-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
        credentials: "include",
      })
      if (res.ok) {
        await fetchPasskeys()
        await fetchAuthMethods()
      }
    } catch {
      // silently fail
    } finally {
      setIsDeletingPasskey(null)
    }
  }

  const startEditingPasskey = (passkey: Passkey) => {
    setEditingPasskeyId(passkey.id)
    setEditingName(passkey.name || "")
  }

  const cancelEditingPasskey = () => {
    setEditingPasskeyId(null)
    setEditingName("")
  }

  const handleRenamePasskey = async (id: string) => {
    setIsUpdatingPasskey(true)
    try {
      const res = await fetch("/api/auth/passkey/update-passkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editingName }),
        credentials: "include",
      })
      if (res.ok) {
        await fetchPasskeys()
        setEditingPasskeyId(null)
        setEditingName("")
      }
    } catch {
      // silently fail
    } finally {
      setIsUpdatingPasskey(false)
    }
  }

  const isSingleAuthMethod = authMethods && authMethods.totalAuthMethods <= 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Warning for single auth method */}
      <AnimatePresence>
        {isSingleAuthMethod && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3"
          >
            <Shield className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-200/80">
              Single authentication method — consider adding a passkey or linking a social account
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Section */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4 flex items-center gap-2">
          <Key className="h-4 w-4" />
          Password
        </h3>

        {isLoadingAuthMethods ? (
          <div className="flex items-center gap-2 text-sm text-text/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            {authMethods?.hasPassword && (
              <div>
                <label className="block text-xs text-text/50 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                  placeholder="Enter current password"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-text/50 mb-1">
                {authMethods?.hasPassword ? "New Password" : "Password"}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                placeholder={authMethods?.hasPassword ? "Enter new password" : "Set a password"}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-text/50 mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
                placeholder="Confirm password"
                required
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isPasswordSubmitting}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isPasswordSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                {authMethods?.hasPassword ? "Change Password" : "Set Password"}
              </button>
              {passwordMessage && (
                <p className={`text-sm ${passwordMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                  {passwordMessage.text}
                </p>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Passkey Section */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 flex items-center gap-2">
            <Fingerprint className="h-4 w-4" />
            Passkeys
          </h3>
          <button
            onClick={handleAddPasskey}
            disabled={isAddingPasskey}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isAddingPasskey ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add Passkey
          </button>
        </div>

        {isLoadingPasskeys ? (
          <div className="flex items-center gap-2 text-sm text-text/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading passkeys...
          </div>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-text/50">No passkeys registered.</p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {passkeys.map((pk) => (
                <motion.div
                  key={pk.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-text/[0.02] p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Fingerprint className="h-4 w-4 text-text/40 shrink-0" />
                    <div className="min-w-0">
                      {editingPasskeyId === pk.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="px-2 py-1 rounded bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60"
                            autoFocus
                          />
                          <button
                            onClick={() => handleRenamePasskey(pk.id)}
                            disabled={isUpdatingPasskey}
                            className="p-1 rounded hover:bg-green-500/10 text-green-400 transition-colors"
                          >
                            {isUpdatingPasskey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={cancelEditingPasskey}
                            className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-text truncate">
                            {pk.name || "Unnamed passkey"}
                          </p>
                          <p className="text-xs text-text/50">
                            {pk.deviceType}
                            {pk.createdAt && (
                              <span className="ml-1">
                                · Added {new Date(pk.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {editingPasskeyId !== pk.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEditingPasskey(pk)}
                        className="p-1.5 rounded hover:bg-text/5 text-text/40 hover:text-text/80 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePasskey(pk.id)}
                        disabled={isDeletingPasskey === pk.id || !!isSingleAuthMethod}
                        title={isSingleAuthMethod ? "Cannot remove your only authentication method" : undefined}
                        className="p-1.5 rounded hover:bg-red-500/10 text-text/40 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isDeletingPasskey === pk.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}

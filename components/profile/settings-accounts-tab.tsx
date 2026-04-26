"use client"

import { useState, useEffect } from "react"
import { Loader2, Link as LinkIcon, Unlink, Shield } from "lucide-react"
import { motion } from "motion/react"
import { FaGoogle, FaDiscord } from "react-icons/fa"
import { authClient } from "@/lib/auth-client"

interface LinkedAccount {
  id: string
  providerId: string
  accountId: string
  createdAt: Date
  updatedAt: Date
  userId: string
  scopes: string[]
}

interface AuthMethods {
  hasPassword: boolean
  passkeyCount: number
  oauthProviders: { providerId: string; id: string }[]
  totalAuthMethods: number
}

const providerConfig: Record<string, { name: string; icon: React.ComponentType<{ className?: string }> | null; color: string; bgColor: string }> = {
  google: { name: "Google", icon: FaGoogle, color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20" },
  discord: { name: "Discord", icon: FaDiscord, color: "text-indigo-400", bgColor: "bg-indigo-500/10 border-indigo-500/20" },
  credential: { name: "Password", icon: null, color: "text-text/60", bgColor: "bg-text/5 border-border" },
}

interface SettingsAccountsTabProps {
  authMethods: AuthMethods | null
  isLoadingAuthMethods: boolean
  onRefreshAuthMethods: () => Promise<void>
}

export function SettingsAccountsTab({ authMethods, isLoadingAuthMethods, onRefreshAuthMethods }: SettingsAccountsTabProps) {
  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [unlinking, setUnlinking] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    fetchAccounts()
    // Check for OAuth callback success
    const params = new URLSearchParams(window.location.search)
    if (params.has("linked")) {
      setMessage({ type: "success", text: "Account linked successfully!" })
      window.history.replaceState({}, "", window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAccounts() {
    try {
      const { data, error } = await authClient.listAccounts()
      if (error || !data) {
        setAccountsError("Failed to load linked accounts")
        setAccounts([])
      } else {
        setAccounts(Array.isArray(data) ? data : [])
        setAccountsError(null)
      }
    } catch {
      setAccountsError("Failed to load linked accounts. Please try again.")
      setAccounts([])
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const refreshAccounts = async () => {
    try {
      const { data } = await authClient.listAccounts()
      if (data) setAccounts(Array.isArray(data) ? data : accounts)
    } catch {
      // silently fail on refresh
    }
  }

  const refreshData = async () => {
    await Promise.all([refreshAccounts(), onRefreshAuthMethods()])
  }

  const handleLink = async (provider: "google" | "discord") => {
    setMessage(null)
    try {
      const { data, error } = await authClient.linkSocial({
        provider,
        callbackURL: window.location.origin + "/profile?linked=true",
      })

      if (error) {
        setMessage({ type: "error", text: error.message || "Failed to link account" })
        return
      }

      if (data?.url) {
        window.location.assign(data.url)
      }
    } catch {
      setMessage({ type: "error", text: "Failed to initiate account linking" })
    }
  }

  const handleUnlink = async (providerId: string) => {
    if (authMethods && authMethods.totalAuthMethods <= 1) return

    setUnlinking(providerId)
    setMessage(null)

    try {
      const { error } = await authClient.unlinkAccount({
        providerId,
      })

      if (error) {
        setMessage({ type: "error", text: error.message || "Failed to unlink account" })
      } else {
        setMessage({ type: "success", text: `${providerConfig[providerId]?.name || providerId} account unlinked` })
        await refreshData()
      }
    } catch {
      setMessage({ type: "error", text: "Failed to unlink account" })
    } finally {
      setUnlinking(null)
    }
  }

  const linkedProviders = new Set(accounts.map((a) => a.providerId))
  const availableProviders = ["google", "discord"].filter((p) => !linkedProviders.has(p))
  const isOnlyAuthMethod = authMethods ? authMethods.totalAuthMethods <= 1 : true

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Warning if only one auth method */}
      {isOnlyAuthMethod && !isLoadingAuthMethods && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
          <Shield className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-yellow-400 font-medium">Single authentication method</p>
            <p className="text-xs text-text/50 mt-1">
              You only have one way to sign in. Consider linking a social account or adding a passkey.
            </p>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      {/* Linked Accounts */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4 flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Linked Accounts
        </h3>

        {accountsError ? (
          <div className="text-center py-4">
            <p className="text-sm text-red-400 mb-2">{accountsError}</p>
            <button
              onClick={() => {
                setAccountsError(null)
                setIsLoadingAccounts(true)
                fetchAccounts()
              }}
              className="text-sm text-primary hover:underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : isLoadingAccounts ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-text/40" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Password status */}
            {authMethods && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-text/5 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-text/10 flex items-center justify-center text-text/40 text-sm font-bold">
                    ●
                  </div>
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-text/40">
                      {authMethods.hasPassword ? "Configured" : "Not set"}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${authMethods.hasPassword ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-text/10 text-text/40 border border-border"}`}>
                  {authMethods.hasPassword ? "Active" : "Inactive"}
                </span>
              </div>
            )}

            {/* OAuth accounts */}
            {accounts.map((account) => {
              const config = providerConfig[account.providerId] || {
                name: account.providerId,
                icon: null,
                color: "text-text/60",
                bgColor: "bg-text/5 border-border",
              }
              const canUnlink = !isOnlyAuthMethod

              return (
                <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-text/5 border border-border">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.bgColor} border`}>
                      {config.icon ? <config.icon className={`h-4 w-4 ${config.color}`} /> : <LinkIcon className={`h-4 w-4 ${config.color}`} />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{config.name}</p>
                      <p className="text-xs text-text/40">Linked</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnlink(account.providerId)}
                    disabled={!canUnlink || unlinking === account.providerId}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {unlinking === account.providerId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                    Unlink
                  </button>
                </div>
              )
            })}

            {/* Passkeys count */}
            {authMethods && authMethods.passkeyCount > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-text/5 border border-border">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-text/10 flex items-center justify-center text-text/40">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Passkeys</p>
                    <p className="text-xs text-text/40">{authMethods.passkeyCount} registered</p>
                  </div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Active
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Link New Account */}
      {availableProviders.length > 0 && (
        <div className="rounded-xl border border-border bg-text/[0.03] p-5">
          <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Link a Social Account</h3>
          <div className="flex flex-wrap gap-3">
            {availableProviders.map((provider) => {
              const config = providerConfig[provider]
              if (!config) return null
              return (
                <button
                  key={provider}
                  onClick={() => handleLink(provider as "google" | "discord")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${config.bgColor} ${config.color} text-sm font-medium hover:opacity-80 transition-opacity cursor-pointer`}
                >
                  {config.icon && <config.icon className="h-4 w-4" />}
                  Link {config.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </motion.div>
  )
}

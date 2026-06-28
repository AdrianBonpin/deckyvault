"use client"

import { useState, useEffect, useCallback } from "react"
import { authClient } from "@/lib/auth-client"
import {
  Loader2,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  AlertCircle,
  Download,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

// Raw API key type from Better Auth (dates are Date objects from the API)
interface RawApiKey {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean
  expiresAt: Date | null
  lastRequest: Date | null
  remaining: number | null
  createdAt: Date
  updatedAt: Date
  referenceId: string
  metadata: Record<string, unknown> | null
  permissions: Record<string, string[]> | null
  configId: string
  refillInterval: number | null
  refillAmount: number | null
  lastRefillAt: Date | null
  rateLimitEnabled: boolean
  rateLimitTimeWindow: number | null
  rateLimitMax: number | null
  requestCount: number
}

interface CreatedApiKey extends RawApiKey {
  key: string // Only returned on creation
}

export function SettingsApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<RawApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyExpiresIn, setNewKeyExpiresIn] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Copy state
  const [copied, setCopied] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const fetchApiKeys = useCallback(async () => {
    try {
      const { data, error } = await authClient.apiKey.list({})
      if (error) {
        setError(error.message || "Failed to load API keys")
        setApiKeys([])
      } else {
        setApiKeys((data?.apiKeys ?? []) as RawApiKey[])
        setError(null)
      }
    } catch {
      setError("Failed to load API keys. Please try again.")
      setApiKeys([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchApiKeys()
  }, [fetchApiKeys])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!newKeyName.trim()) {
      setCreateError("Name is required")
      return
    }

    setIsCreating(true)
    try {
      const expiresIn = newKeyExpiresIn
        ? parseInt(newKeyExpiresIn) * 24 * 60 * 60
        : undefined

      const { data, error } = await authClient.apiKey.create({
        name: newKeyName.trim(),
        expiresIn,
      })

      if (error) {
        setCreateError(error.message || "Failed to create API key")
      } else if (data) {
        setCreatedKey(data as unknown as CreatedApiKey)
        await fetchApiKeys()
        setNewKeyName("")
        setNewKeyExpiresIn("")
        setShowCreateForm(false)
      }
    } catch {
      setCreateError("An unexpected error occurred")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (keyId: string) => {
    setDeletingId(keyId)
    setMessage(null)
    try {
      const { error } = await authClient.apiKey.delete({ keyId })
      if (error) {
        setMessage({
          type: "error",
          text: error.message || "Failed to delete API key",
        })
      } else {
        setMessage({ type: "success", text: "API key deleted" })
        await fetchApiKeys()
      }
    } catch {
      setMessage({
        type: "error",
        text: "Failed to delete API key. Please try again.",
      })
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (date: Date | string | null): string => {
    if (!date) return "Never"
    try {
      const d = date instanceof Date ? date : new Date(date)
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return String(date)
    }
  }

  const handleCopyKey = async () => {
    if (createdKey?.key) {
      try {
        await navigator.clipboard.writeText(createdKey.key)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea")
        textarea.value = createdKey.key
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  const handleDownloadConfig = () => {
    if (!createdKey?.key) return
    const config = {
      apiKey: createdKey.key,
      exportPath: "/home/deck/Downloads",
      baseUrl: "https://deckyvault.xyz",
      hardwareSlug: null,
    }
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "deckyvault-config.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  

  // Show the created key modal
  if (createdKey) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className='space-y-6'
      >
        <div className='rounded-xl border border-green-500/30 bg-green-500/10 p-6'>
          <div className='flex items-center gap-2 mb-4'>
            <Check className='h-5 w-5 text-green-400' />
            <h3 className='text-sm font-medium text-green-400'>
              API Key Created
            </h3>
          </div>

          <p className='text-sm text-text/70 mb-3'>
            Copy your API key now. You won&apos;t be able to see it again.
          </p>

          <div className='relative mb-4'>
            <div className='w-full px-4 py-3 rounded-lg bg-text/5 border border-border font-mono text-sm break-all pr-20'>
              {showKey
                ? createdKey.key
                : `${createdKey.key.substring(0, 12)}${"•".repeat(Math.min(createdKey.key.length - 12, 20))}`}
            </div>
            <div className='absolute right-2 top-1/2 -translate-y-1/2 flex gap-1'>
              <button
                onClick={() => setShowKey(!showKey)}
                className='p-1.5 rounded hover:bg-text/5 text-text/40 hover:text-text/80 transition-colors cursor-pointer'
                title={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? (
                  <EyeOff className='h-4 w-4' />
                ) : (
                  <Eye className='h-4 w-4' />
                )}
              </button>
              <button
                onClick={handleCopyKey}
                className='p-1.5 rounded hover:bg-text/5 text-text/40 hover:text-text/80 transition-colors cursor-pointer'
                title='Copy to clipboard'
              >
                {copied ? (
                  <Check className='h-4 w-4 text-green-400' />
                ) : (
                  <Copy className='h-4 w-4' />
                )}
              </button>
            </div>
          </div>

          {createdKey.name && (
            <p className='text-xs text-text/50'>
              Name: <span className='text-text/70'>{createdKey.name}</span>
            </p>
          )}
          {createdKey.expiresAt && (
            <p className='text-xs text-text/50 mt-1'>
              Expires:{" "}
              <span className='text-text/70'>
                {formatDate(createdKey.expiresAt)}
              </span>
            </p>
          )}

          <button
            onClick={() => setCreatedKey(null)}
            className='mt-4 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer'
          >
            Done
          </button>

          <button
            onClick={handleDownloadConfig}
            className='mt-2 px-4 py-2 rounded-lg border border-border text-text/70 text-sm font-medium hover:border-primary/40 hover:text-primary transition-colors cursor-pointer flex items-center justify-center gap-2 w-full'
          >
            <Download className='h-4 w-4' />
            Download Plugin Config
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className='space-y-6'
    >
      {/* Header */}
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-medium uppercase tracking-wider text-text/60 flex items-center gap-2'>
          <Key className='h-4 w-4' />
          API Keys
        </h3>
        <button
          onClick={() => {
            setShowCreateForm(!showCreateForm)
            setCreateError(null)
          }}
          className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors cursor-pointer'
        >
          <Plus className='h-3.5 w-3.5' />
          {showCreateForm ? "Cancel" : "Create Key"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`text-sm px-4 py-2 rounded-lg ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400 border border-green-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className='rounded-xl border border-border bg-text/3 p-5 overflow-hidden'
          >
            <form onSubmit={handleCreate} className='space-y-3'>
              <div>
                <label className='block text-xs text-text/50 mb-1'>
                  Key Name <span className='text-red-400'>*</span>
                </label>
                <input
                  type='text'
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors'
                  placeholder='e.g. Decky Loader Plugin'
                  maxLength={32}
                  required
                />
              </div>
              <div>
                <label className='block text-xs text-text/50 mb-1'>
                  Expires In (days){" "}
                  <span className='text-text/40'>(optional — leave empty for no expiry)</span>
                </label>
                <input
                  type='number'
                  value={newKeyExpiresIn}
                  onChange={(e) => setNewKeyExpiresIn(e.target.value)}
                  className='w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors'
                  placeholder='Leave empty for no expiry'
                  min={1}
                  max={365}
                />
              </div>

              {createError && (
                <p className='text-sm text-red-400 flex items-center gap-1'>
                  <AlertCircle className='h-3.5 w-3.5' />
                  {createError}
                </p>
              )}

              <button
                type='submit'
                disabled={isCreating}
                className='flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer w-full sm:w-auto'
              >
                {isCreating ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Key className='h-4 w-4' />
                )}
                Create API Key
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Key List */}
      {error ? (
        <div className='text-center py-8'>
          <p className='text-sm text-red-400 mb-2'>{error}</p>
          <button
            onClick={() => {
              setError(null)
              setIsLoading(true)
              fetchApiKeys()
            }}
            className='text-sm text-primary hover:underline cursor-pointer'
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className='flex items-center gap-2 text-sm text-text/50 py-8'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Loading API keys...
        </div>
      ) : apiKeys.length === 0 ? (
        <div className='text-center py-8'>
          <Key className='h-8 w-8 text-text/20 mx-auto mb-3' />
          <p className='text-sm text-text/50'>
            No API keys created yet.
          </p>
          <p className='text-xs text-text/30 mt-1'>
            Create an API key to use with the Decky Loader plugin or other external tools.
          </p>
        </div>
      ) : (
        <div className='space-y-3'>
          <AnimatePresence>
            {apiKeys.map((ak) => (
              <motion.div
                key={ak.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                className='flex items-center justify-between gap-3 rounded-lg border border-border bg-text/2 p-4'
              >
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <Key className='h-4 w-4 text-text/40 shrink-0' />
                    <p className='text-sm font-medium text-text truncate'>
                      {ak.name || "Unnamed key"}
                    </p>
                    {!ak.enabled && (
                      <span className='text-xs px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'>
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className='flex flex-wrap items-center gap-x-3 gap-y-1 mt-1'>
                    {ak.start && (
                      <span className='text-xs font-mono text-text/40'>
                        {ak.start}...
                      </span>
                    )}
                    {ak.expiresAt && (
                      <span className='text-xs text-text/40 flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        Expires {formatDate(ak.expiresAt)}
                      </span>
                    )}
                    {ak.lastRequest && (
                      <span className='text-xs text-text/40'>
                        Last used {formatDate(ak.lastRequest)}
                      </span>
                    )}
                    <span className='text-xs text-text/30'>
                      Created {formatDate(ak.createdAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(ak.id)}
                  disabled={deletingId === ak.id}
                  className='p-2 rounded hover:bg-red-500/10 text-text/40 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer'
                  title='Delete API key'
                >
                  {deletingId === ak.id ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Trash2 className='h-4 w-4' />
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info */}
      <div className='rounded-xl border border-border bg-text/2 p-4'>
        <p className='text-xs text-text/40'>
          <strong className='text-text/60'>Using API keys:</strong> Pass your API key as the{" "}
          <code className='text-primary bg-text/5 px-1 rounded'>x-api-key</code> header when
          making requests to DeckyVault&apos;s API. You can use these keys with the Decky
          Loader plugin or any automation tool.
        </p>
      </div>
    </motion.div>
  )
}
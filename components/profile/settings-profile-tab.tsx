"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Loader2, Save } from "lucide-react"
import { motion } from "motion/react"

import { ProfilePhotoUpload } from "@/components/profile/profile-photo-upload"

interface SettingsProfileTabProps {
  name: string
  email: string
  role: string | null
  createdAt: string
  image?: string | null
  userId: string
  onImageChange?: (url: string | null) => void
}

export function SettingsProfileTab({ name, email, role, createdAt, image, userId, onImageChange }: SettingsProfileTabProps) {
  const [displayName, setDisplayName] = useState(name)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setMessage({ type: "error", text: "Name cannot be empty" })
      return
    }

    setIsSaving(true)
    setMessage(null)

    const { error } = await authClient.updateUser({
      name: displayName.trim(),
    })

    if (error) {
      setMessage({ type: "error", text: error.message || "Failed to update name" })
    } else {
      setMessage({ type: "success", text: "Name updated successfully" })
    }
    setIsSaving(false)
  }

  const joinDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Profile Photo */}
      <ProfilePhotoUpload
        currentImage={image ?? null}
        userName={name}
        userId={userId}
        onImageChange={async (url) => {
          onImageChange?.(url)
          await authClient.updateUser({ image: url ?? "" })
        }}
      />

      {/* Display Name */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Display Name</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-text/5 border border-border text-sm text-text focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors"
              placeholder="Your display name"
            />
          </div>
          <button
            onClick={handleSaveName}
            disabled={isSaving || displayName === name}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Email</h3>
        <p className="text-sm text-text/80">{email}</p>
        <p className="text-xs text-text/40 mt-1">Email changes require verification. Contact support if needed.</p>
      </div>

      {/* Account Info (read-only) */}
      <div className="rounded-xl border border-border bg-text/[0.03] p-5">
        <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Account Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text/50">Role</span>
            <p className="text-text/80 capitalize">{role || "user"}</p>
          </div>
          <div>
            <span className="text-text/50">Member since</span>
            <p className="text-text/80">{joinDate}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

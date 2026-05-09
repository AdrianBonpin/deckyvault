"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Camera, Trash2, Loader2, Upload } from "lucide-react"

interface ProfilePhotoUploadProps {
  currentImage: string | null
  userName: string
  userId: string
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function isR2Avatar(url: string): boolean {
  return url.includes(".r2.dev")
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase()
}

export function ProfilePhotoUpload({ currentImage, userName, userId }: ProfilePhotoUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImage)
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const tempUrlRef = useRef<string | null>(null)

  const cleanupTempUrl = () => {
    if (tempUrlRef.current) {
      URL.revokeObjectURL(tempUrlRef.current)
      tempUrlRef.current = null
    }
  }

  useEffect(() => {
    return cleanupTempUrl
  }, [])

  useEffect(() => {
    setPreviewUrl(currentImage)
  }, [currentImage])

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Only JPEG, PNG, and WebP images are allowed."
    }
    if (file.size > MAX_SIZE_BYTES) {
      return "File must be under 5MB."
    }
    return null
  }

  const handleFile = async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setErrorMessage(validationError)
      setUploadState("error")
      return
    }

    setErrorMessage(null)
    setUploadState("uploading")
    cleanupTempUrl()

    const objectUrl = URL.createObjectURL(file)
    tempUrlRef.current = objectUrl
    setPreviewUrl(objectUrl)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/user/profile-photo", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Upload failed")
      }

      const data = await res.json()
      if (data.imageUrl) {
        setPreviewUrl(data.imageUrl)
        cleanupTempUrl()
      }
      setUploadState("success")
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed")
      setUploadState("error")
      setPreviewUrl(currentImage)
      cleanupTempUrl()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }, [currentImage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDelete = async () => {
    if (!previewUrl || !isR2Avatar(previewUrl)) return

    setUploadState("uploading")
    try {
      const res = await fetch("/api/user/profile-photo", {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Delete failed")
      }

      setPreviewUrl(null)
      setUploadState("idle")
      setErrorMessage(null)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Delete failed")
      setUploadState("error")
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const showDelete = previewUrl ? isR2Avatar(previewUrl) : false

  return (
    <div className="rounded-xl border border-border bg-text/[0.03] p-5">
      <h3 className="text-sm font-medium uppercase tracking-wider text-text/60 mb-4">Profile Photo</h3>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        {/* Avatar area */}
        <div
          className={`relative shrink-0 rounded-full overflow-hidden w-[128px] h-[128px] cursor-pointer transition-all ${
            isDragging ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
          }`}
          onClick={triggerFileInput}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Upload profile photo"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              triggerFileInput()
            }
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`${userName}'s profile photo`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-4xl font-bold select-none">
              {getInitials(userName)}
            </div>
          )}

          {/* Upload overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
            <Camera className="h-8 w-8 text-white" />
          </div>

          {uploadState === "uploading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={triggerFileInput}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              disabled={uploadState === "uploading"}
            >
              <Upload className="h-4 w-4" />
              Upload Photo
            </button>

            <AnimatePresence>
              {showDelete && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={handleDelete}
                  disabled={uploadState === "uploading"}
                  className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-text/5 text-text/60 hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  aria-label="Delete profile photo"
                  title="Delete profile photo"
                >
                  <Trash2 className="h-4 w-4" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <p className="text-xs text-text/50">
            JPEG, PNG, or WebP. Max 5MB.
          </p>

          <AnimatePresence>
            {errorMessage && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="text-sm text-red-400"
              >
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>

          {uploadState === "success" && !errorMessage && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-green-400"
            >
              Photo updated successfully.
            </motion.p>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        aria-hidden="true"
        id="profile-photo-input"
      />
      <label htmlFor="profile-photo-input" className="sr-only">
        Choose profile photo
      </label>
    </div>
  )
}

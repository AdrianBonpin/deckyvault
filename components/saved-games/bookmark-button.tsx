"use client"

import { useState, useEffect } from "react"
import { Bookmark, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { useSession } from "@/lib/auth-client"

interface BookmarkButtonProps {
  gameId: string
  className?: string
}

export function BookmarkButton({ gameId, className = "" }: BookmarkButtonProps) {
  const { data: session } = useSession()
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isToggling, setIsToggling] = useState(false)

  useEffect(() => {
    if (!session) {
      setIsLoading(false)
      return
    }

    async function checkSaved() {
      try {
        const res = await fetch(`/api/user/me/saved-games/check/${gameId}`)
        if (res.ok) {
          const data = await res.json()
          setIsSaved(data.saved)
        }
      } catch (err) {
        console.error("Failed to check saved status:", err)
      } finally {
        setIsLoading(false)
      }
    }

    checkSaved()
  }, [session, gameId])

  const toggleSave = async () => {
    if (!session || isToggling) return

    setIsToggling(true)
    try {
      if (isSaved) {
        const res = await fetch(`/api/user/me/saved-games/${gameId}`, {
          method: "DELETE",
        })
        if (res.ok) {
          setIsSaved(false)
        }
      } else {
        const res = await fetch("/api/user/me/saved-games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId }),
        })
        if (res.ok) {
          setIsSaved(true)
        }
      }
    } catch (err) {
      console.error("Failed to toggle saved game:", err)
    } finally {
      setIsToggling(false)
    }
  }

  if (!session || isLoading) {
    return null
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={toggleSave}
      disabled={isToggling}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        isSaved
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-text/5 border-border text-text/50 hover:text-text hover:border-primary/30"
      } ${className}`}
    >
      <AnimatePresence mode="wait">
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <motion.div
            key={isSaved ? "saved" : "not-saved"}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
          >
            <Bookmark
              className={`h-4 w-4 ${isSaved ? "fill-primary" : ""}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <span className="text-sm font-medium">
        {isSaved ? "Saved" : "Save"}
      </span>
    </motion.button>
  )
}

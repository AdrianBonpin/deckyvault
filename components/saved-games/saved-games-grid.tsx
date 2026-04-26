"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Bookmark, Loader2, X, Gamepad2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface SavedGame {
  id: string
  gameId: string
  createdAt: string
  gameTitle: string
  gameHeaderImage: string | null
  gameCapsuleImage: string | null
  gameSteamAppId: number | null
}

export function SavedGamesGrid() {
  const [games, setGames] = useState<SavedGame[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSaved() {
      try {
        const res = await fetch("/api/user/me/saved-games")
        if (res.ok) {
          setGames(await res.json())
        }
      } catch (err) {
        console.error("Failed to fetch saved games:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSaved()
  }, [])

  const removeGame = async (id: string, gameId: string) => {
    setRemovingId(id)
    try {
      const res = await fetch(`/api/user/me/saved-games/${gameId}`, {
        method: "DELETE",
      })
      if (res.ok) {
        setGames((prev) => prev.filter((g) => g.id !== id))
      }
    } catch (err) {
      console.error("Failed to remove saved game:", err)
    } finally {
      setRemovingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="text-center py-12 text-text/40">
        <Bookmark className="h-8 w-8 mx-auto mb-2" />
        <p>No saved games yet</p>
        <p className="text-xs mt-1">
          Save games from their detail pages to see them here
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <AnimatePresence>
        {games.map((game) => (
          <motion.div
            key={game.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative group"
          >
            <Link
              href={`/game/${game.gameId}`}
              className="block rounded-xl overflow-hidden border border-border hover:border-primary/30 transition-colors"
            >
              {game.gameHeaderImage ? (
                <Image
                  src={game.gameHeaderImage}
                  alt={game.gameTitle}
                  width={300}
                  height={140}
                  unoptimized
                  className="w-full h-32 object-cover"
                />
              ) : (
                <div className="w-full h-32 bg-text/5 flex items-center justify-center">
                  <Gamepad2 className="h-8 w-8 text-text/20" />
                </div>
              )}
              <div className="p-3">
                <p className="text-sm font-medium truncate">
                  {game.gameTitle}
                </p>
                <p className="text-xs text-text/40 mt-1">
                  Saved {new Date(game.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Link>

            <button
              onClick={() => removeGame(game.id, game.gameId)}
              disabled={removingId === game.id}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-text/70 hover:text-red-400 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
            >
              {removingId === game.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

"use client"

import { useState, useCallback } from "react"
import { ImageIcon, Loader2, Search, ExternalLink } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface SteamGridResult {
  id: number
  name: string
}

interface SteamGridImage {
  id: number
  url: string
  thumb: string
  width: number
  height: number
}

interface NonSteamImageStepProps {
  headerImage: string
  capsuleImage: string
  onChange: (headerImage: string, capsuleImage: string) => void
}

export function NonSteamImageStep({
  headerImage,
  capsuleImage,
  onChange,
}: NonSteamImageStepProps) {
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [loadingGrids, setLoadingGrids] = useState(false)
  const [results, setResults] = useState<SteamGridResult[]>([])
  const [grids, setGrids] = useState<SteamGridImage[]>([])
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null)
  const [manualUrl, setManualUrl] = useState("")
  const [showManual, setShowManual] = useState(false)

  const search = useCallback(async () => {
    if (!query.trim() || query.trim().length < 2) return
    setSearching(true)
    setResults([])
    setGrids([])
    setSelectedGameId(null)
    try {
      const res = await fetch(`/api/steamgrid/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error("Search failed")
      const data = await res.json()
      setResults((data.data || []).slice(0, 8))
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [query])

  const fetchGrids = useCallback(async (gameId: number) => {
    setLoadingGrids(true)
    setGrids([])
    setSelectedGameId(gameId)
    try {
      const res = await fetch(`/api/steamgrid/grids/${gameId}?styles=alternate`)
      if (!res.ok) throw new Error("Failed to fetch grids")
      const data = await res.json()
      const images: SteamGridImage[] = (data.data || [])
        .filter((g: SteamGridImage) => g.url)
        .sort((a: SteamGridImage, b: SteamGridImage) => {
          // Prefer 600x900
          const aScore = a.width === 600 && a.height === 900 ? 2 : a.width === 342 ? 1 : 0
          const bScore = b.width === 600 && b.height === 900 ? 2 : b.width === 342 ? 1 : 0
          return bScore - aScore
        })
      setGrids(images.slice(0, 12))
    } catch {
      setGrids([])
    } finally {
      setLoadingGrids(false)
    }
  }, [])

  const handleSelectImage = (url: string) => {
    // Use the same image for both header and capsule
    onChange(url, url)
  }

  const handleManualSubmit = () => {
    if (!manualUrl.trim()) return
    onChange(manualUrl.trim(), manualUrl.trim())
  }

  const currentImage = capsuleImage || headerImage

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <ImageIcon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Cover Art</h3>
          <p className="text-xs text-text/60 mt-1">
            Search SteamGridDB for cover art, or paste an image URL manually.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Search SteamGridDB..."
              className="w-full px-4 py-3 pr-10 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/30" />
          </div>
          <button
            type="button"
            onClick={search}
            disabled={searching || query.trim().length < 2}
            className="px-4 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex flex-wrap gap-2"
            >
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => fetchGrids(r.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    selectedGameId === r.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-text/5 text-text/70 hover:bg-text/10 hover:border-text/30"
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid images */}
        {loadingGrids && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        <AnimatePresence>
          {grids.length > 0 && !loadingGrids && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"
            >
              {grids.map((g) => {
                const isSelected = capsuleImage === g.url
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectImage(g.url)}
                    className={`relative aspect-[2/3] rounded-lg overflow-hidden border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/50"
                        : "border-border hover:border-text/30"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.thumb || g.url}
                      alt="Cover"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Manual URL */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          className="text-xs text-text/50 hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" />
          {showManual ? "Hide manual URL input" : "Enter image URL manually"}
        </button>
        <AnimatePresence>
          {showManual && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <input
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://example.com/cover.jpg"
                className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
              />
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={!manualUrl.trim()}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-text/70 hover:bg-text/5 transition-colors disabled:opacity-40 cursor-pointer"
              >
                Use this URL
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Preview */}
      {currentImage && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text/60">Selected Cover</p>
          <div className="w-32 aspect-[2/3] rounded-lg overflow-hidden border border-border bg-text/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage}
              alt="Selected cover"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}
    </div>
  )
}

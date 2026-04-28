"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { SearchIcon, XIcon, Gamepad2Icon } from "lucide-react"

interface SearchResult {
  id: string
  appId: number | null
  title: string
  image: string | null
  source: string
}

interface GameSelectorProps {
  selectedGames: SearchResult[]
  onSelect: (game: SearchResult) => void
  onRemove: (gameId: string) => void
  maxSelections?: number
}

export function GameSelector({ selectedGames, onSelect, onRemove, maxSelections = 4 }: GameSelectorProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    let cancelled = false
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search/unified?q=${encodeURIComponent(query)}`)
        if (!res.ok) throw new Error("Search failed")
        const data = await res.json()
        if (!cancelled) {
          setResults(
            (data.results || [])
              .filter((r: any) => !selectedGames.some(sg => sg.id === (r.id || `steam-${r.appId}`)))
              .slice(0, 8)
              .map((r: any) => ({
                id: r.id || `steam-${r.appId}`,
                appId: r.appId,
                title: r.title,
                image: r.image,
                source: r.source,
              }))
          )
        }
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query, selectedGames])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const canAdd = selectedGames.length < maxSelections

  return (
    <div className="flex flex-col gap-3" ref={wrapperRef}>
      {/* Selected games chips */}
      {selectedGames.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedGames.map(game => (
            <div
              key={game.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-sm"
            >
              {game.image ? (
                <Image src={game.image} alt={game.title} width={20} height={30} className="rounded" />
              ) : (
                <Gamepad2Icon className="h-4 w-4 text-text/30" />
              )}
              <span className="text-text/80 max-w-40 truncate">{game.title}</span>
              <button
                onClick={() => onRemove(game.id)}
                className="text-text/40 hover:text-text/80 transition-colors cursor-pointer"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      {canAdd && (
        <div className="relative">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-text/5">
            <SearchIcon className="h-4 w-4 text-text/40" />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder="Search for games to compare..."
              className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text/40"
            />
          </div>

          {/* Dropdown results */}
          {open && (query.length >= 2) && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-background shadow-lg max-h-64 overflow-y-auto">
              {loading && (
                <div className="px-4 py-3 text-xs text-text/40">Searching...</div>
              )}
              {!loading && results.length === 0 && (
                <div className="px-4 py-3 text-xs text-text/40">No results found</div>
              )}
              {!loading && results.map(game => (
                <button
                  key={game.id}
                  onClick={() => {
                    onSelect(game)
                    setQuery("")
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-text/5 transition-colors cursor-pointer text-left"
                >
                  {game.image ? (
                    <Image src={game.image} alt={game.title} width={24} height={36} className="rounded" />
                  ) : (
                    <Gamepad2Icon className="h-4 w-4 text-text/30" />
                  )}
                  <span className="text-sm text-text/80 truncate">{game.title}</span>
                  {game.source !== "steam" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 capitalize ml-auto">
                      {game.source}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!canAdd && (
        <p className="text-xs text-text/40">Maximum {maxSelections} games can be compared</p>
      )}
    </div>
  )
}

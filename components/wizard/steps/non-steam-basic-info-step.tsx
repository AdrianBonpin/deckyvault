"use client"

import { useState, useCallback, useRef } from "react"
import { Info, AlertTriangle, Loader2 } from "lucide-react"

export interface BasicInfoData {
  title: string
  developer: string
  publisher: string
  description: string
  source: "manual" | "gog" | "epic"
  storeUrl: string
  genres: string[]
  releaseDate: string
}

interface NonSteamBasicInfoStepProps {
  value: BasicInfoData
  onChange: (value: BasicInfoData) => void
}

interface DuplicateHint {
  id: string
  title: string
  source: string
}

export function NonSteamBasicInfoStep({ value, onChange }: NonSteamBasicInfoStepProps) {
  const [checking, setChecking] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateHint[]>([])
  const [genreInput, setGenreInput] = useState(value.genres.join(", "))
  const lastCheckedTitle = useRef("")

  const update = (field: keyof BasicInfoData, val: string | string[]) => {
    onChange({ ...value, [field]: val })
  }

  const checkDuplicates = useCallback(async (title: string) => {
    if (!title.trim() || title.trim().length < 2) {
      setDuplicates([])
      return
    }
    if (lastCheckedTitle.current === title.trim()) return
    lastCheckedTitle.current = title.trim()

    setChecking(true)
    try {
      const res = await fetch(`/api/search/unified?q=${encodeURIComponent(title)}`)
      if (!res.ok) {
        setDuplicates([])
        return
      }
      const data = await res.json()
      const results = (data.results || []) as Array<{
        id?: string
        title: string
        source: string
      }>
      const matches = results
        .filter(
          (r) =>
            r.title.toLowerCase().includes(title.toLowerCase()) ||
            title.toLowerCase().includes(r.title.toLowerCase())
        )
        .slice(0, 3)
        .map((r) => ({
          id: r.id || String(r.title),
          title: r.title,
          source: r.source,
        }))
      setDuplicates(matches)
    } catch {
      setDuplicates([])
    } finally {
      setChecking(false)
    }
  }, [])

  const handleGenreBlur = () => {
    const parsed = genreInput
      .split(",")
      .map((g) => g.trim())
      .filter((g) => g.length > 0)
    onChange({ ...value, genres: parsed })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Basic Info</h3>
          <p className="text-xs text-text/60 mt-1">
            Enter the game details. Title is required.
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text/60">
          Title <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={value.title}
            onChange={(e) => update("title", e.target.value)}
            onBlur={(e) => checkDuplicates(e.target.value)}
            placeholder="e.g. Hollow Knight"
            className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
          />
          {checking && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-text/30" />
          )}
        </div>
        {duplicates.length > 0 && (
          <div className="flex items-start gap-2 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-400">
              <span className="font-medium">Did you mean:</span>{" "}
              {duplicates.map((d, i) => (
                <span key={d.id}>
                  <a
                    href={`/game/${d.id}`}
                    className="underline hover:text-amber-300"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {d.title}
                  </a>
                  {i < duplicates.length - 1 ? ", " : ""}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Source */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text/60">Source</label>
        <div className="relative">
          <select
            value={value.source}
            onChange={(e) =>
              update("source", e.target.value as "manual" | "gog" | "epic")
            }
            className="w-full appearance-none px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors cursor-pointer"
          >
            <option value="manual">Manual Entry</option>
            <option value="gog">GOG</option>
            <option value="epic">Epic Games Store</option>
          </select>
          <svg
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Developer / Publisher */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text/60">Developer</label>
          <input
            type="text"
            value={value.developer}
            onChange={(e) => update("developer", e.target.value)}
            placeholder="e.g. Team Cherry"
            className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text/60">Publisher</label>
          <input
            type="text"
            value={value.publisher}
            onChange={(e) => update("publisher", e.target.value)}
            placeholder="e.g. Team Cherry"
            className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text/60">Description</label>
        <textarea
          value={value.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Short game description..."
          rows={4}
          className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors resize-none"
        />
      </div>

      {/* Store URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text/60">Store URL</label>
        <input
          type="url"
          value={value.storeUrl}
          onChange={(e) => update("storeUrl", e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
        />
      </div>

      {/* Genres */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text/60">Genres</label>
        <input
          type="text"
          value={genreInput}
          onChange={(e) => setGenreInput(e.target.value)}
          onBlur={handleGenreBlur}
          placeholder="Action, Adventure, Platformer"
          className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
        />
        <p className="text-[10px] text-text/30">Comma-separated list</p>
      </div>

      {/* Release Date */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text/60">Release Date</label>
        <input
          type="text"
          value={value.releaseDate}
          onChange={(e) => update("releaseDate", e.target.value)}
          placeholder="e.g. 2017-02-24"
          className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
        />
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SettingsIcon, Gamepad2Icon } from "lucide-react"

interface HardwareDevice {
  slug: string
  name: string
  deviceType: string
}

interface PlatformSupportEntry {
  hardwareSlug: string
  isSupported: boolean
  protonStatus: string
}

interface GameData {
  id: string
  title: string | null
  developer: string | null
  publisher: string | null
  description: string | null
  source: string
  storeUrl: string | null
  headerImage: string | null
  capsuleImage: string | null
  genres: string[] | null
  releaseDate: string | null
  createdBy: string | null
}

interface Props {
  game: GameData
  platformSupport: PlatformSupportEntry[]
  hardwareList: HardwareDevice[]
  isOwner: boolean
  isAdmin: boolean
}

export function NonSteamEditForm({ game, platformSupport, hardwareList, isOwner, isAdmin }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(game.title ?? "")
  const [developer, setDeveloper] = useState(game.developer ?? "")
  const [publisher, setPublisher] = useState(game.publisher ?? "")
  const [description, setDescription] = useState(game.description ?? "")
  const [storeUrl, setStoreUrl] = useState(game.storeUrl ?? "")
  const [headerImage, setHeaderImage] = useState(game.headerImage ?? "")
  const [capsuleImage, setCapsuleImage] = useState(game.capsuleImage ?? "")
  const [genresStr, setGenresStr] = useState(game.genres?.join(", ") ?? "")
  const [releaseDate, setReleaseDate] = useState(game.releaseDate ?? "")
  const [platforms, setPlatforms] = useState<PlatformSupportEntry[]>(platformSupport)

  const canEdit = isOwner || isAdmin

  const handleTogglePlatform = (slug: string) => {
    setPlatforms(prev => {
      const existing = prev.find(p => p.hardwareSlug === slug)
      if (existing) {
        return prev.filter(p => p.hardwareSlug !== slug)
      }
      return [...prev, { hardwareSlug: slug, isSupported: true, protonStatus: "unknown" }]
    })
  }

  const handleProtonChange = (slug: string, protonStatus: string) => {
    setPlatforms(prev =>
      prev.map(p => p.hardwareSlug === slug ? { ...p, protonStatus } : p)
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/games/${game.id}/manual`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          developer: developer.trim() || null,
          publisher: publisher.trim() || null,
          description: description.trim() || null,
          storeUrl: storeUrl.trim() || null,
          headerImage: headerImage.trim() || null,
          capsuleImage: capsuleImage.trim() || null,
          genres: genresStr.split(",").map(g => g.trim()).filter(Boolean),
          releaseDate: releaseDate.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to update game")
      }
      router.push(`/game/${game.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update game")
    } finally {
      setLoading(false)
    }
  }

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <SettingsIcon className="h-10 w-10 text-text/20" />
        <p className="text-sm text-text/40">Only the creator or an admin can edit this game.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Basic Info */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-text/60">Basic Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Developer</label>
            <input
              type="text"
              value={developer}
              onChange={e => setDeveloper(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Publisher</label>
            <input
              type="text"
              value={publisher}
              onChange={e => setPublisher(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Store URL</label>
            <input
              type="text"
              value={storeUrl}
              onChange={e => setStoreUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text/60">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary resize-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Genres (comma-separated)</label>
            <input
              type="text"
              value={genresStr}
              onChange={e => setGenresStr(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Release Date</label>
            <input
              type="date"
              value={releaseDate}
              onChange={e => setReleaseDate(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-text/60">Images</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Header Image URL</label>
            <input
              type="text"
              value={headerImage}
              onChange={e => setHeaderImage(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text/60">Capsule Image URL</label>
            <input
              type="text"
              value={capsuleImage}
              onChange={e => setCapsuleImage(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Platform Support */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-text/60">Platform Support</h2>
        <div className="flex flex-col gap-3">
          {hardwareList.map(device => {
            const active = platforms.find(p => p.hardwareSlug === device.slug)
            return (
              <div key={device.slug} className="flex items-center justify-between p-3 rounded-lg border border-border bg-text/3">
                <div className="flex items-center gap-3">
                  <Gamepad2Icon className="h-4 w-4 text-text/50" />
                  <span className="text-sm font-medium">{device.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleTogglePlatform(device.slug)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? "bg-green-500/20 border-green-500/30 text-green-400"
                        : "border-border text-text/40 hover:text-text/60"
                    }`}
                  >
                    {active ? "Supported" : "Unsupported"}
                  </button>
                  {active && (
                    <select
                      value={active.protonStatus}
                      onChange={e => handleProtonChange(device.slug, e.target.value)}
                      className="text-xs bg-background border border-border rounded-md px-2 py-1.5 text-text/80 focus:outline-none focus:border-primary"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="native">Native</option>
                      <option value="proton">Proton</option>
                      <option value="unsupported">Unsupported</option>
                    </select>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg border border-border text-sm text-text/70 hover:bg-text/5 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !title.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}

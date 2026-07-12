import { useState, useEffect, useCallback, useRef } from "react"
import type { DeckyVaultImportV1, HardwareSlug } from "@deckyvault/shared"
import { getSettings, setSetting, detectCurrentGame } from "./api"

// ── Types ───────────────────────────────────────────────────────

export interface PluginSettings {
  apiKey: string
  exportPath: string
  hardwareSlug: string | null  // null = auto-detect
  baseUrl: string
}

const DEFAULT_SETTINGS: PluginSettings = {
  apiKey: "",
  exportPath: "/home/deck/Downloads",
  hardwareSlug: null,
  baseUrl: "https://deckyvault.xyz",
}

export type RecordingState = "idle" | "recording" | "stopped"

export interface SessionData {
  appId: number | null
  gameName: string
  startedAt: number
  // Auto-captured (filled after stop)
  fpsAvg: number | null
  fpsLow: number | null
  fpsHigh: number | null
  fpsOnePercentLow: number | null
  tdpWatts: number | null
  hardwareSlug: string
  hardwareName: string
  osVersion: string
  protonVersion: string
  versionString: string
  buildId: string
  // Manual inputs (filled by user in the form)
  upscalerType: string
  upscalerVersion: string
  frameGenMethod: string
  settingsJson: string
  loadTimeSsd: string
  loadTimeSd: string
  launchOptions: string
  userNotes: string
}

export interface RecentSession {
  appId: number | null
  gameName: string
  fpsAvg: number | null
  date: string  // ISO string
}

function createEmptySession(): SessionData {
  return {
    appId: null,
    gameName: "",
    startedAt: 0,
    fpsAvg: null,
    fpsLow: null,
    fpsHigh: null,
    fpsOnePercentLow: null,
    tdpWatts: null,
    hardwareSlug: "",
    hardwareName: "",
    osVersion: "",
    protonVersion: "",
    versionString: "",
    buildId: "",
    upscalerType: "none",
    upscalerVersion: "",
    frameGenMethod: "none",
    settingsJson: "",
    loadTimeSsd: "",
    loadTimeSd: "",
    launchOptions: "",
    userNotes: "",
  }
}

// ── Settings Hook ───────────────────────────────────────────────

export function useSettings() {
  const [settings, setSettings] = useState<PluginSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const raw = await getSettings()
        setSettings({
          apiKey: (raw.apiKey as string) || "",
          exportPath: (raw.exportPath as string) || DEFAULT_SETTINGS.exportPath,
          hardwareSlug: (raw.hardwareSlug as string) || null,
          baseUrl: (raw.baseUrl as string) || DEFAULT_SETTINGS.baseUrl,
        })
      } catch (e) {
        console.error("Failed to load settings:", e)
      } finally {
        setLoaded(true)
      }
    }
    load()
  }, [])

  const updateSetting = useCallback(async (key: keyof PluginSettings, value: string | null) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    try {
      await setSetting(key, value)
    } catch (e) {
      console.error(`Failed to save setting ${key}:`, e)
    }
  }, [])

  return { settings, updateSetting, loaded }
}

// ── Session Hook ────────────────────────────────────────────────

export function useSession() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [session, setSession] = useState<SessionData>(createEmptySession())
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [error, setError] = useState<string>("")
  const currentAppIdRef = useRef<number | null>(null)
  const currentAppNameRef = useRef<string>("")

  const startRecording = useCallback(() => {
    setError("")
    setSession({
      ...createEmptySession(),
      appId: currentAppIdRef.current,
      gameName: currentAppNameRef.current,
      startedAt: Date.now(),
    })
    setRecordingState("recording")
  }, [])

  const stopRecording = useCallback(() => {
    setRecordingState("stopped")
  }, [])

  const updateSession = useCallback((updates: Partial<SessionData>) => {
    setSession((prev) => ({ ...prev, ...updates }))
  }, [])

  const addToRecent = useCallback((sess: SessionData) => {
    const recent: RecentSession = {
      appId: sess.appId,
      gameName: sess.gameName,
      fpsAvg: sess.fpsAvg,
      date: new Date().toISOString(),
    }
    setRecentSessions((prev) => [recent, ...prev].slice(0, 5))
  }, [])

  const reset = useCallback(() => {
    setRecordingState("idle")
    setSession(createEmptySession())
    setError("")
  }, [])

  // Called when a game starts (via SteamClient event)
  const onGameStart = useCallback((appId: number, gameName: string) => {
    currentAppIdRef.current = appId
    currentAppNameRef.current = gameName
  }, [])

  // Called when a game stops (via SteamClient event)
  const onGameStop = useCallback(() => {
    currentAppIdRef.current = null
    currentAppNameRef.current = ""
  }, [])

  // Manual game name override (fallback when SteamClient events don't fire)
  const setGameName = useCallback((name: string, appId?: number) => {
    currentAppNameRef.current = name
    if (appId !== undefined) currentAppIdRef.current = appId
    setSession((prev) => ({ ...prev, gameName: name, appId: appId ?? prev.appId }))
  }, [])

  return {
    recordingState,
    session,
    recentSessions,
    error,
    setError,
    startRecording,
    stopRecording,
    updateSession,
    addToRecent,
    reset,
    onGameStart,
    onGameStop,
    setGameName,
  }
}

// ── Game Detection Hook ──────────────────────────────────────────
// Polls the Python backend to detect the currently running game.
// Falls back to manual input if no game is detected.

export function useGameDetection(
  setGameName: (name: string, appId?: number) => void,
  recordingState: RecordingState,
) {
  const [detecting, setDetecting] = useState(false)
  const lastDetectedRef = useRef<string>("")

  useEffect(() => {
    // Don't poll while recording (user is already in-game)
    if (recordingState !== "idle") return

    const interval = setInterval(async () => {
      try {
        setDetecting(true)
        const result = await detectCurrentGame()
        if (result.name && result.name !== lastDetectedRef.current) {
          lastDetectedRef.current = result.name
          setGameName(result.name, result.appId ?? undefined)
        }
      } catch {
        // Silently retry
      } finally {
        setDetecting(false)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [recordingState, setGameName])

  return { detecting }
}

// ── FPS Sanitizer ────────────────────────────────────────────────

const FPS_MAX = 1000

/** Clamp/cap an FPS value to [0, 1000]; return null for null/undefined/NaN. */
export function sanitizeFps(value: number | null | undefined): number | null {
  if (value == null) return null
  const n = Number(value)
  if (isNaN(n)) return null
  if (n < 0) return 0
  if (n > FPS_MAX) return FPS_MAX
  return n
}

// ── Payload Builder ─────────────────────────────────────────────

export function buildImportPayload(sess: SessionData): DeckyVaultImportV1 {
  return {
    version: 1,
    steamAppId: sess.appId ?? 0,
    hardwareSlug: sess.hardwareSlug,
    fpsAvg: sess.fpsAvg == null || sess.fpsAvg <= 0 ? 0 : sanitizeFps(sess.fpsAvg)!,
    fpsLow: sanitizeFps(sess.fpsLow),
    fpsOnePercentLow: sanitizeFps(sess.fpsOnePercentLow),
    fpsHigh: sanitizeFps(sess.fpsHigh),
    protonVersion: sess.protonVersion || null,
    osVersion: sess.osVersion || null,
    versionString: sess.versionString || null,
    buildId: sess.buildId || null,
    upscalerType: sess.upscalerType,
    upscalerVersion: sess.upscalerVersion || null,
    frameGenMethod: sess.frameGenMethod,
    tdpWatts: sess.tdpWatts,
    loadTimeSsd: sess.loadTimeSsd ? Number(sess.loadTimeSsd) : null,
    loadTimeSd: sess.loadTimeSd ? Number(sess.loadTimeSd) : null,
    launchOptions: sess.launchOptions || null,
    settingsJson: sess.settingsJson ? tryParseJson(sess.settingsJson) : null,
    userNotes: sess.userNotes || null,
  }
}

function tryParseJson(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return [{ text }]
  }
}

export { DEFAULT_SETTINGS }
export type { HardwareSlug }
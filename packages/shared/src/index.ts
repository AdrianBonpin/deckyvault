// ── DeckyVault Import Format (v1) ──────────────────────────────
// This is the format produced by the Decky Loader plugin
// and consumed by POST /api/performance/import

export const VALID_UPSCALER_TYPES = [
  "none", "fsr", "dlss", "xess", "lsfg", "other",
] as const

export const VALID_FRAME_GEN_METHODS = [
  "none", "fsr_fg", "dlss_fg", "lsfg", "other",
] as const

export const VALID_ANTICHEAT_STATUSES = [
  "none", "supported", "unsupported", "unknown",
] as const

export type UpscalerType = (typeof VALID_UPSCALER_TYPES)[number]
export type FrameGenMethod = (typeof VALID_FRAME_GEN_METHODS)[number]
export type AntiCheatStatus = (typeof VALID_ANTICHEAT_STATUSES)[number]

export interface DeckyVaultImportV1 {
  version: 1
  steamAppId: number
  hardwareSlug: string
  fpsAvg: number
  fpsLow?: number | null
  fpsOnePercentLow?: number | null
  fpsHigh?: number | null
  protonVersion?: string | null
  osVersion?: string | null
  upscalerType?: string
  upscalerVersion?: string | null
  frameGenMethod?: string
  tdpWatts?: number | null
  loadTimeSsd?: number | null
  loadTimeSd?: number | null
  launchOptions?: string | null
  settingsJson?: unknown[] | null
  userNotes?: string | null
  customSystem?: boolean
  versionString?: string | null
  buildId?: string | null
  antiCheatRelevant?: boolean
  antiCheatName?: string | null
  antiCheatStatus?: string
}

// ── Known hardware slugs ───────────────────────────────────────
export const KNOWN_HARDWARE_SLUGS = [
  "steamdeck-lcd",
  "steamdeck-oled",
  "steamdeck-lcd-64gb",
  "steamdeck-lcd-256gb",
  "steamdeck-lcd-512gb",
  "steamdeck-oled-512gb",
  "steamdeck-oled-1tb",
  "rog-ally",
  "rog-ally-x",
  "legion-go",
  "msi-claw",
] as const

export type HardwareSlug = (typeof KNOWN_HARDWARE_SLUGS)[number]

// ── API Response Types ──────────────────────────────────────────
export interface GameLookupResponse {
  game: {
    id: string
    steamAppId: number | null
    title: string
    slug: string | null
    headerImage: string | null
    capsuleImage: string | null
    developer: string | null
    publisher: string | null
  }
  version: {
    id: string
    versionString: string | null
    buildId: string | null
    isLatest: boolean
    createdAt: string
  } | null
}

export interface ImportResponse {
  id: string
  gameId: string
  versionId: string
  createdAt: string
  authMethod: "session" | "api-key"
}
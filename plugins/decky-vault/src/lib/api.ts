import { callable } from "@decky/api"

// ── Settings ────────────────────────────────────────────────────
export const getSettings = callable<[], Record<string, unknown>>("get_settings")
export const setSetting = callable<[key: string, value: unknown], Record<string, unknown>>("set_setting")

// ── MangoHud ────────────────────────────────────────────────────
export const checkMangohud = callable<[], {
  installed: boolean
  path: string
  version: string
  error?: string
  debug?: string
}>("check_mangohud")

export const writeMangohudConfig = callable<[], {
  success: boolean
  path: string
  error?: string
}>("write_mangohud_config")

export const getMangohudConfig = callable<[], {
  exists: boolean
  content: string
  path: string
}>("get_mangohud_config")

export const readAndParseMangohudLog = callable<[logPath?: string], {
  fpsAvg?: number
  fpsLow?: number
  fpsHigh?: number
  fpsOnePercentLow?: number | null
  tdpWatts?: number | null
  error?: string
}>("read_and_parse_mangohud_log")

export const clearMangohudLog = callable<[], {
  success: boolean
  deleted?: Array<{ name: string }>
  skipped?: Array<{ name: string; reason: string }>
  error?: string
}>("clear_mangohud_log")

export const deleteLogFile = callable<[path: string], {
  success: boolean
  deleted?: boolean
  error?: string
}>("delete_log_file")

export const findMangohudLog = callable<[], {
  path: string | null
}>("find_mangohud_log")

export const startMangohudLogging = callable<[], {
  success: boolean
  error?: string
}>("start_mangohud_logging")

export const stopMangohudLogging = callable<[], {
  success: boolean
  error?: string
}>("stop_mangohud_logging")

// ── System Info ─────────────────────────────────────────────────
export const getHardwareInfo = callable<[], {
  slug: string
  name: string
  raw: string
}>("get_hardware_info")

export const getOsVersion = callable<[], string>("get_os_version")

export const getProtonVersion = callable<[appId: number], string>("get_proton_version")

export const getLaunchOptions = callable<[appId: number], string>("get_launch_options")

// ── Export ──────────────────────────────────────────────────────
export const exportToFile = callable<[data: Record<string, unknown>, exportPath: string], {
  success: boolean
  path: string
  error?: string
}>("export_to_file")

// ── Upload ──────────────────────────────────────────────────────
export const uploadToDeckyvault = callable<[
  data: Record<string, unknown>,
  apiKey: string,
  baseUrl?: string
], {
  success: boolean
  data?: { id: string; gameId: string; versionId: string; createdAt: string; authMethod: string }
  error?: string
  status?: number
}>("upload_to_deckyvault")

export const listScreenshots = callable<[limit?: number], {
  screenshots: Array<{ path: string; name: string; mtime: number; size: number }>
  error?: string
}>("list_screenshots")

export const readScreenshot = callable<[path: string, maxWidth?: number], {
  dataUrl: string
  error?: string
}>("read_screenshot")

export const uploadScreenshots = callable<[
  entryId: string,
  screenshotPaths: string[],
  apiKey: string,
  baseUrl?: string
], {
  success: boolean
  uploaded?: number
  error?: string
  status?: number
}>("upload_screenshots")

export const testApiKey = callable<[apiKey: string, baseUrl?: string], {
  valid: boolean
  error?: string
}>("test_api_key")

export const detectCurrentGame = callable<[], {
  appId: number | null
  name: string
}>("detect_current_game")

export const debugListTmp = callable<[], {
  files: Array<{ name: string; size: number; mtime: number }>
}>("debug_list_tmp")

// ── Config Export/Import ────────────────────────────────────────
export const exportConfig = callable<[settings: {
  apiKey: string
  exportPath: string
  baseUrl: string
  hardwareSlug: string | null
}], {
  success: boolean
  path?: string
  error?: string
}>("export_config")

export const importConfig = callable<[], {
  success: boolean
  settings?: {
    apiKey: string
    exportPath: string
    baseUrl: string
    hardwareSlug: string | null
  }
  error?: string
}>("import_config")

// ── Plugin Pairing ──────────────────────────────────────────
export const initiatePair = callable<[baseUrl?: string], {
  success: boolean
  token?: string
  qrUrl?: string
  expiresAt?: string
  error?: string
}>("initiate_pair")

export const checkPairStatus = callable<[token: string, baseUrl?: string], {
  status: "pending" | "confirmed" | "expired" | "invalid"
  apiKey?: string
  keyName?: string
  error?: string
}>("check_pair_status")
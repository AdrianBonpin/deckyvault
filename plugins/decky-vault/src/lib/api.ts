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
  error?: string
}>("clear_mangohud_log")

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
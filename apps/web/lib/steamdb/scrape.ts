import { getCachedVersion, setCachedVersion, isOnCooldown, setCooldown, setExtendedCooldown } from "./cache"

const STEAMDB_APP_URL = "https://steamdb.info/app"

interface ScrapeResult {
  versionString: string | null
  buildId: string | null
}

/**
 * Scrape version/build info from SteamDB for a given Steam App ID.
 *
 * SteamDB is a client-side rendered app — the raw HTML from a fetch() is a
 * skeleton that gets populated by JavaScript. To work around this we:
 * 1. Search ALL <script> tags for embedded JSON/JS objects (hydration data)
 * 2. Parse table rows with flexible regex (catches server-rendered fragments)
 * 3. Try JSON-LD structured data
 * 4. Extract build IDs from multiple known patterns
 *
 * All failures are non-fatal — the submit wizard gracefully degrades.
 */
export async function scrapeSteamDBVersion(steamAppId: number): Promise<ScrapeResult & { cached: boolean }> {
  // Check cache first
  const cached = getCachedVersion(steamAppId)
  if (cached) {
    return { versionString: cached.versionString, buildId: cached.buildId, cached: true }
  }

  // Check cooldown
  if (isOnCooldown(steamAppId)) {
    return { versionString: null, buildId: null, cached: true }
  }

  // If scraping is disabled via env, skip
  if (process.env.STEAMDB_SCRAPING_ENABLED === "false") {
    return { versionString: null, buildId: null, cached: true }
  }

  // ── Primary: fetch the main SteamDB app page ─────────────────────
  let html: string | null = null

  try {
    const res = await fetch(`${STEAMDB_APP_URL}/${steamAppId}/`, {
      headers: {
        "User-Agent": "DeckyVault/1.0 (deckyvault.xyz; game version lookup)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(10000),
    })

    if (res.status === 429 || res.status === 403) {
      console.warn(`[steamdb] Rate-limited or blocked for app ${steamAppId} (HTTP ${res.status})`)
      setExtendedCooldown(steamAppId)
      return { versionString: null, buildId: null, cached: true }
    }

    if (!res.ok) {
      console.warn(`[steamdb] Non-OK response for app ${steamAppId}: HTTP ${res.status}`)
      setCooldown(steamAppId, 30)
      return { versionString: null, buildId: null, cached: true }
    }

    html = await res.text()
  } catch (err) {
    console.warn(`[steamdb] Network error fetching app ${steamAppId}:`, err instanceof Error ? err.message : err)
    setCooldown(steamAppId, 30)
    return { versionString: null, buildId: null, cached: true }
  }

  const result = parseSteamDBHtml(html, steamAppId)

  // ── Log diagnostic info for debugging ────────────────────────────
  if (result.versionString || result.buildId) {
    console.log(`[steamdb] Found data for app ${steamAppId}: version="${result.versionString ?? "?"}", build="${result.buildId ?? "?"}"`)
  } else {
    // Log a snippet of the HTML to help debug parsing failures
    const snippet = html.slice(0, 300).replace(/\s+/g, " ").trim()
    console.warn(`[steamdb] No version/build found for app ${steamAppId}. HTML preview: ${snippet}...`)
  }

  setCachedVersion(steamAppId, result.versionString, result.buildId)
  return { ...result, cached: false }
}

// ── Parsing ────────────────────────────────────────────────────────

function parseSteamDBHtml(html: string, steamAppId: number): ScrapeResult {
  let versionString: string | null = null
  let buildId: string | null = null

  // ── Strategy 1 (PRIMARY): Embedded JSON/JS data in <script> tags ──
  // SPAs often embed initial state for hydration. Search ALL script tags
  // for JSON-like objects containing known version/build keys.
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi)
  if (scriptMatches) {
    for (const scriptTag of scriptMatches) {
      // Skip JSON-LD (handled separately below)
      if (scriptTag.includes('application/ld+json')) continue

      const inner = scriptTag.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "")

      // Try to find JSON objects within the script content
      const objects = extractTopLevelObjects(inner)
      for (const obj of objects) {
        if (!versionString) versionString = findVersionInObject(obj)
        if (!buildId) buildId = findBuildIdInObject(obj)
        if (versionString && buildId) break
      }

      if (versionString && buildId) break
    }
  }

  // ── Strategy 2: <script type="application/json"> tags ──────────────
  if (!versionString || !buildId) {
    const jsonScripts = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)
    if (jsonScripts) {
      for (const tag of jsonScripts) {
        const inner = tag.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "")
        try {
          const obj = JSON.parse(inner)
          if (!versionString) versionString = findVersionInObject(obj)
          if (!buildId) buildId = findBuildIdInObject(obj)
          if (versionString && buildId) break
        } catch {
          // Not valid JSON — continue
        }
      }
    }
  }

  // ── Strategy 3: Table rows — more flexible patterns ──────────────
  if (!versionString) {
    versionString = extractVersionFromTable(html)
  }

  // ── Strategy 4: JSON-LD structured data ──────────────────────────
  if (!versionString) {
    versionString = extractVersionFromJsonLD(html)
  }

  // ── Strategy 5: Build ID from multiple patterns ──────────────────
  if (!buildId) {
    buildId = extractBuildIdFromHtml(html)
  }

  return { versionString, buildId }
}

// ── Helpers: JSON object extraction ────────────────────────────────

/**
 * Extract top-level JSON-like objects from JavaScript code.
 * Handles patterns like:
 *   window.__DATA__ = { ... }
 *   var appData = { ... }
 *   JSON.parse('{ ... }')
 *   __NEXT_DATA__ = { ... }
 */
function extractTopLevelObjects(js: string): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = []

  // Pattern 1: JSON.parse('...') or JSON.parse("{...}")
  const parseRegex = /JSON\.parse\((["'])((?:\\.|(?!\1)[^\\])*?)\1\)/g
  let match
  while ((match = parseRegex.exec(js)) !== null) {
    try {
      const obj = JSON.parse(match[2])
      if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
        objects.push(obj as Record<string, unknown>)
      }
    } catch {
      // JSON parse failure — ignore
    }
  }

  // Pattern 2: Assignment of object literals
  // Matches: var/let/const/window.NAME = { ... }
  // We look for balanced braces after `=`
  const assignRegex = /(?:var|let|const|window\.\w+|self\.\w+|this\.\w+)\s*\w*\s*=\s*(\{)/g
  while ((match = assignRegex.exec(js)) !== null) {
    const startIdx = match.index + match[0].length - 1 // position of opening {
    const objStr = extractBalancedBraces(js, startIdx)
    if (objStr) {
      try {
        // Try as JSON first, then as JS object
        const obj = safeParseJSObject(objStr)
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          objects.push(obj as Record<string, unknown>)
        }
      } catch {
        // Parse failure — ignore
      }
    }
  }

  return objects
}

/** Extract text between balanced { } braces */
function extractBalancedBraces(str: string, startIdx: number): string | null {
  if (str[startIdx] !== "{") return null
  let depth = 0
  let inString = false
  let stringChar = ""
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i]
    if (inString) {
      if (ch === "\\") { i++; continue }
      if (ch === stringChar) { inString = false }
      continue
    }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue }
    if (ch === "{") { depth++ }
    else if (ch === "}") {
      depth--
      if (depth === 0) return str.slice(startIdx, i + 1)
    }
  }
  return null
}

/** Parse a JS object literal string to a plain object (handles unquoted keys) */
function safeParseJSObject(jsObj: string): unknown {
  // First try direct JSON.parse
  try { return JSON.parse(jsObj) } catch { /* fall through */ }

  // Try converting JS object to valid JSON (quote unquoted keys)
  try {
    const jsonLike = jsObj
      .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')  // quote keys
      .replace(/'/g, '"')                                           // single → double quotes
      .replace(/,\s*}/g, "}")                                       // trailing commas
      .replace(/,\s*]/g, "]")
    return JSON.parse(jsonLike)
  } catch {
    return null
  }
}

// ── Helpers: value extraction from objects ─────────────────────────

const VERSION_KEYS = [
  "version", "versionString", "version_string", "displayVersion",
  "latestVersion", "appVersion", "gameVersion", "name",
  "lastKnownName", "last_known_name", "Last Known Name",
]

const BUILD_KEYS = [
  "buildid", "buildId", "build_id", "build", "latestBuild",
  "appBuild", "publicBuild", "buildNumber", "build_number",
]

function findVersionInObject(obj: Record<string, unknown>, depth = 0): string | null {
  if (depth > 3 || !obj) return null

  for (const key of VERSION_KEYS) {
    const val = obj[key]
    if (typeof val === "string" && val.length > 0 && val.length < 200) {
      // Filter out non-version strings (URLs, descriptions, etc.)
      if (!val.startsWith("http") && !val.includes("<") && val.length > 1) {
        return val.trim()
      }
    }
  }

  // Recurse into nested objects
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = findVersionInObject(val as Record<string, unknown>, depth + 1)
      if (found) return found
    }
  }

  return null
}

function findBuildIdInObject(obj: Record<string, unknown>, depth = 0): string | null {
  if (depth > 3 || !obj) return null

  for (const key of BUILD_KEYS) {
    const val = obj[key]
    if (typeof val === "number" && val > 0 && val < 99999999) {
      return String(val)
    }
    if (typeof val === "string" && /^\d{3,10}$/.test(val)) {
      return val
    }
  }

  // Recurse into nested objects
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = findBuildIdInObject(val as Record<string, unknown>, depth + 1)
      if (found) return found
    }
  }

  return null
}

// ── Helpers: table-based extraction ────────────────────────────────

function extractVersionFromTable(html: string): string | null {
  const patterns = [
    // "Last known name" / "Last recorded name" in a table
    /(?:Last\s*(?:known|recorded)\s*name)\s*<\/t[hd]>\s*<t[hd][^>]*>([^<]+)</i,
    // "Version" label in a definition list or table
    /<t[hd][^>]*>\s*Version\s*<\/t[hd]>\s*<t[hd][^>]*>([^<]+)</i,
    // "Current version" label
    /(?:Current|Latest)\s+version[^<]*<\/t[hd]>\s*<t[hd][^>]*>([^<]+)</i,
    // Generic: any table row with "version" as label
    /<td[^>]*>([^<]*[Vv]ersion[^<]*)<\/td>\s*<td[^>]*>([^<]+)</i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      const val = (match[2] || match[1]).trim()
      if (val && val.length > 1 && !val.startsWith("http") && !val.includes("<")) {
        return val
      }
    }
  }

  // Inline element pattern: "Last known name" followed by a <span> or other
  // inline tag inside the same cell (e.g. <td>Last known name <span>v1.2.3</span></td>)
  const inlineMatch = html.match(/Last known name[^<]*<[^>]*>([^<]+)</i)
  if (inlineMatch) {
    const val = inlineMatch[1].trim()
    if (val.length > 1 && !val.startsWith("http")) return val
  }

  // Broader: look for "Last known name" anywhere nearby a <td> with content
  const looseMatch = html.match(/Last known name[^<]*(?:<[^>]+>)*?\s*<t[hd][^>]*>([^<]+)</i)
  if (looseMatch) {
    const val = looseMatch[1].trim()
    if (val.length > 1 && !val.startsWith("http")) return val
  }

  return null
}

// ── Helpers: JSON-LD extraction ────────────────────────────────────

function extractVersionFromJsonLD(html: string): string | null {
  const ldMatches = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  if (!ldMatches) return null

  for (const tag of ldMatches) {
    const inner = tag.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "")
    try {
      const parsed = JSON.parse(inner)
      // Walk the JSON-LD graph
      const version = findVersionInObject(parsed)
      if (version) return version
    } catch {
      // Non-fatal
    }
  }

  return null
}

// ── Helpers: build ID extraction ───────────────────────────────────

function extractBuildIdFromHtml(html: string): string | null {
  const patterns = [
    // Table: Build ID cell
    /Build\s*ID\s*<\/t[hd]>\s*<t[hd][^>]*>(\d{3,10})/i,
    // Inline buildid attribute
    /buildid[^>]*>(\d{3,10})/i,
    // "Build" label in table
    /<t[hd][^>]*>\s*Build\s*<\/t[hd]>\s*<t[hd][^>]*>(\d{3,10})/i,
    // data-build-id attribute
    /data-build-?id\s*=\s*["'](\d{3,10})["']/i,
    // "public" branch build in a table
    /public\s*<\/t[hd]>\s*<t[hd][^>]*>(\d{3,10})/i,
    // Generic: any bare build ID near "build" text
    /build[^<]*<\/t[hd]>\s*<t[hd][^>]*>(\d{3,10})/i,
    // Numeric build ID in JSON-like context
    /"buildid"\s*:\s*(\d{3,10})/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      const val = match[1].trim()
      const num = parseInt(val, 10)
      if (num > 0 && num < 99999999) return val
    }
  }

  return null
}

// Export for testing
export const _parseSteamDBHtml = parseSteamDBHtml
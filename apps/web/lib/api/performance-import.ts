import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  performanceEntries,
  gameVersions,
  games,
  hardware,
  gamePlatformSupport,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { requireAuthWithApiKeyFallback } from "@/lib/auth/api-key-guard"
import { recalculatePlayability } from "./playability"

const VALID_UPSCALER_TYPES = ["none", "fsr", "dlss", "xess", "lsfg", "other"] as const
const VALID_FRAME_GEN_METHODS = ["none", "fsr_fg", "dlss_fg", "lsfg", "other"] as const
const VALID_ANTICHEAT_STATUSES = ["none", "supported", "unsupported", "unknown"] as const

type UpscalerType = (typeof VALID_UPSCALER_TYPES)[number]
type FrameGenMethod = (typeof VALID_FRAME_GEN_METHODS)[number]
type AntiCheatStatus = (typeof VALID_ANTICHEAT_STATUSES)[number]

const FPS_MIN_AVG = 1
const FPS_MIN_OTHER = 0
const FPS_MAX = 1000

export type FpsInput = {
  fpsAvg: number
  fpsLow?: number | null
  fpsOnePercentLow?: number | null
  fpsHigh?: number | null
}

export type FpsValues = {
  fpsAvg: number
  fpsLow: number | null
  fpsOnePercentLow: number | null
  fpsHigh: number | null
}

export type FpsValidationResult =
  | { ok: true; values: FpsValues }
  | { ok: false; error: string }

export function validateFps(input: FpsInput): FpsValidationResult {
  const fpsAvg = Number(input.fpsAvg)
  if (input.fpsAvg == null || isNaN(fpsAvg) || fpsAvg < FPS_MIN_AVG || fpsAvg > FPS_MAX) {
    return { ok: false, error: `fpsAvg must be between ${FPS_MIN_AVG} and ${FPS_MAX}` }
  }
  const fpsLow = input.fpsLow != null ? Number(input.fpsLow) : null
  if (fpsLow !== null && (isNaN(fpsLow) || fpsLow < FPS_MIN_OTHER || fpsLow > FPS_MAX)) {
    return { ok: false, error: `fpsLow must be between ${FPS_MIN_OTHER} and ${FPS_MAX}` }
  }
  const fpsOnePercentLow = input.fpsOnePercentLow != null ? Number(input.fpsOnePercentLow) : null
  if (fpsOnePercentLow !== null && (isNaN(fpsOnePercentLow) || fpsOnePercentLow < FPS_MIN_OTHER || fpsOnePercentLow > FPS_MAX)) {
    return { ok: false, error: `fpsOnePercentLow must be between ${FPS_MIN_OTHER} and ${FPS_MAX}` }
  }
  const fpsHigh = input.fpsHigh != null ? Number(input.fpsHigh) : null
  if (fpsHigh !== null && (isNaN(fpsHigh) || fpsHigh < FPS_MIN_OTHER || fpsHigh > FPS_MAX)) {
    return { ok: false, error: `fpsHigh must be between ${FPS_MIN_OTHER} and ${FPS_MAX}` }
  }
  return { ok: true, values: { fpsAvg, fpsLow, fpsOnePercentLow, fpsHigh } }
}

export const performanceImportRoutes = new Elysia({
  prefix: "/performance",
  detail: { tags: ["Performance"] },
}).post(
  "/import",
  async ({ body, request, set }) => {
    // ── Auth: session or API key ──────────────────────────────────
    const guard = await requireAuthWithApiKeyFallback(request.headers)
    if (!guard.ok) {
      set.status = guard.status
      return { error: guard.error }
    }

    // ── Validate version (1 only for now) ─────────────────────────
    if (body.version !== 1) {
      set.status = 400
      return { error: "Unsupported import format version" }
    }

    // ── Validate FPS fields (before game lookup so a 400 is never masked by a 404) ──
    const fpsResult = validateFps({
      fpsAvg: body.fpsAvg,
      fpsLow: body.fpsLow,
      fpsOnePercentLow: body.fpsOnePercentLow,
      fpsHigh: body.fpsHigh,
    })
    if (!fpsResult.ok) {
      set.status = 400
      return { error: fpsResult.error }
    }
    const { fpsAvg, fpsLow, fpsOnePercentLow, fpsHigh } = fpsResult.values

    // ── Resolve game version from steamAppId ──────────────────────
    const steamAppId = body.steamAppId
    if (!steamAppId) {
      set.status = 400
      return { error: "steamAppId is required" }
    }

    const [game] = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.steamAppId, steamAppId))
      .limit(1)

    if (!game) {
      set.status = 404
      return {
        error: `No game found with steamAppId ${steamAppId}. Submit the game on DeckyVault first.`,
      }
    }

    // Find the latest version, or create one if needed
    let [version] = await db
      .select({ id: gameVersions.id })
      .from(gameVersions)
      .where(
        and(
          eq(gameVersions.gameId, game.id),
          eq(gameVersions.isLatest, true),
        ),
      )
      .limit(1)

    if (!version) {
      // Get the most recent version
      const [existing] = await db
        .select({ id: gameVersions.id })
        .from(gameVersions)
        .where(eq(gameVersions.gameId, game.id))
        .orderBy(gameVersions.createdAt)
        .limit(1)

      if (existing) {
        version = existing
      } else {
        // Create a stub version so we can create the entry
        const [newVersion] = await db
          .insert(gameVersions)
          .values({
            gameId: game.id,
            isLatest: true,
            versionString: body.versionString ?? null,
            buildId: body.buildId ?? null,
          })
          .returning({ id: gameVersions.id })
        version = newVersion
      }
    }

    // ── Validate hardware ─────────────────────────────────────────
    const hardwareSlug = body.hardwareSlug
    const [device] = await db
      .select({ slug: hardware.slug, deviceType: hardware.deviceType })
      .from(hardware)
      .where(eq(hardware.slug, hardwareSlug))
      .limit(1)

    if (!device) {
      set.status = 400
      return {
        error: `Unknown hardware slug: "${hardwareSlug}". Available devices: see /api/hardware`,
      }
    }

    // ── Validate enums ────────────────────────────────────────────
    const rawUpscalerType = body.upscalerType ?? "none"
    const upscalerType: UpscalerType = VALID_UPSCALER_TYPES.includes(
      rawUpscalerType as UpscalerType,
    )
      ? (rawUpscalerType as UpscalerType)
      : "none"

    const rawFrameGenMethod = body.frameGenMethod ?? "none"
    const frameGenMethod: FrameGenMethod = VALID_FRAME_GEN_METHODS.includes(
      rawFrameGenMethod as FrameGenMethod,
    )
      ? (rawFrameGenMethod as FrameGenMethod)
      : "none"

    // ── Validate other numeric fields ─────────────────────────────
    const tdpWatts = body.tdpWatts != null ? Number(body.tdpWatts) : null
    if (tdpWatts !== null && (isNaN(tdpWatts) || tdpWatts <= 0)) {
      set.status = 400
      return { error: "tdpWatts must be greater than 0" }
    }

    const loadTimeSsd = body.loadTimeSsd != null ? Number(body.loadTimeSsd) : null
    const loadTimeSd = body.loadTimeSd != null ? Number(body.loadTimeSd) : null

    // ── Validate userNotes length ─────────────────────────────────
    const userNotes = body.userNotes ?? null
    if (userNotes && typeof userNotes === "string" && userNotes.length > 5000) {
      set.status = 400
      return { error: "userNotes must be 5000 characters or less" }
    }

    // ── Create the performance entry ──────────────────────────────
    const [entry] = await db
      .insert(performanceEntries)
      .values({
        versionId: version.id,
        hardwareSlug,
        userId: guard.user.id,
        fpsAvg,
        fpsLow,
        fpsOnePercentLow,
        fpsHigh,
        protonVersion: body.protonVersion ?? null,
        osVersion: body.osVersion ?? null,
        upscalerType,
        upscalerVersion: body.upscalerVersion ?? null,
        frameGenMethod,
        loadTimeSsd,
        loadTimeSd,
        tdpWatts,
        launchOptions: body.launchOptions ?? null,
        settingsJson: body.settingsJson ?? null,
        userNotes,
        customSystem: body.customSystem ?? false,
      })
      .returning()

    // ── Update / create gamePlatformSupport ──────────────────────
    const [existingSupport] = await db
      .select()
      .from(gamePlatformSupport)
      .where(
        and(
          eq(gamePlatformSupport.gameId, game.id),
          eq(gamePlatformSupport.hardwareSlug, hardwareSlug),
        ),
      )
      .limit(1)

    if (existingSupport) {
      await db
        .update(gamePlatformSupport)
        .set({
          antiCheatRelevant:
            body.antiCheatRelevant ?? existingSupport.antiCheatRelevant,
          antiCheatName: body.antiCheatRelevant
            ? (body.antiCheatName ?? existingSupport.antiCheatName)
            : null,
          antiCheatStatus: (body.antiCheatStatus ??
            existingSupport.antiCheatStatus) as AntiCheatStatus,
          updatedAt: new Date(),
        })
        .where(eq(gamePlatformSupport.id, existingSupport.id))
    } else {
      await db.insert(gamePlatformSupport).values({
        gameId: game.id,
        hardwareSlug,
        isSupported: true,
        protonStatus: "unknown",
        antiCheatRelevant: body.antiCheatRelevant ?? false,
        antiCheatName: body.antiCheatRelevant ? (body.antiCheatName ?? null) : null,
        antiCheatStatus: (body.antiCheatStatus ?? "unknown") as AntiCheatStatus,
        playabilityStatus: "unknown",
      })
    }

    // Fire-and-forget playability recalculation
    recalculatePlayability(game.id).catch((err) =>
      console.error("Failed to recalculate playability:", err),
    )

    set.status = 201
    return {
      id: entry.id,
      gameId: game.id,
      versionId: version.id,
      createdAt: entry.createdAt.toISOString(),
      authMethod: guard.keyId ? "api-key" : "session",
    }
  },
  {
    body: t.Object({
      version: t.Number(),
      steamAppId: t.Number(),
      hardwareSlug: t.String(),
      fpsAvg: t.Number(),
      fpsLow: t.Optional(t.Nullable(t.Number())),
      fpsOnePercentLow: t.Optional(t.Nullable(t.Number())),
      fpsHigh: t.Optional(t.Nullable(t.Number())),
      protonVersion: t.Optional(t.Nullable(t.String())),
      osVersion: t.Optional(t.Nullable(t.String())),
      versionString: t.Optional(t.Nullable(t.String())),
      buildId: t.Optional(t.Nullable(t.String())),
      upscalerType: t.Optional(t.String()),
      upscalerVersion: t.Optional(t.Nullable(t.String())),
      frameGenMethod: t.Optional(t.String()),
      tdpWatts: t.Optional(t.Nullable(t.Number())),
      loadTimeSsd: t.Optional(t.Nullable(t.Number())),
      loadTimeSd: t.Optional(t.Nullable(t.Number())),
      launchOptions: t.Optional(t.Nullable(t.String())),
      settingsJson: t.Optional(t.Nullable(t.Any())),
      userNotes: t.Optional(t.Nullable(t.String())),
      customSystem: t.Optional(t.Boolean()),
      antiCheatRelevant: t.Optional(t.Boolean()),
      antiCheatName: t.Optional(t.Nullable(t.String())),
      antiCheatStatus: t.Optional(t.String()),
    }),
    detail: {
      description:
        "Import a performance benchmark from a DeckyVault plugin export (.deckyvault.json). " +
        "Accepts either session cookies or an x-api-key header for authentication. " +
        "The steamAppId is used to resolve the game and its latest version automatically.",
    },
  },
)
import { Elysia, t } from "elysia"
import { randomBytes } from "node:crypto"
import { db } from "@/lib/db/index"
import { pluginPairing } from "@/lib/db/schema"
import { eq, and, lt } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { authenticateWithApiKey } from "@/lib/auth/api-key-guard"

const PAIRING_TTL_MS = 10 * 60 * 1000 // 10 minutes

function generatePairingToken(): string {
  return "pair_" + randomBytes(24).toString("hex")
}

/**
 * Build the public site origin used in the QR code URL.
 * Prefers the configured BETTER_AUTH_URL, falls back to the request origin.
 */
function getSiteOrigin(request: Request): string {
  const configured = process.env.BETTER_AUTH_URL
  if (configured) return configured.replace(/\/$/, "")
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}

export const pluginPairingRoutes = new Elysia({
  prefix: "/plugin",
  detail: { tags: ["Plugin"] },
})
  // ── Verify API key: plugin checks if its key is still valid ──
  .get(
    "/verify-key",
    async ({ request, set }) => {
      const guard = await authenticateWithApiKey(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { valid: false, error: guard.error }
      }
      return {
        valid: true,
        user: { name: guard.user.name, image: guard.user.image },
      }
    },
    {
      detail: {
        summary: "Verify a Decky plugin API key",
        description:
          "Checks whether the x-api-key header contains a valid, enabled API key. Used by the plugin to test its saved key.",
      },
    },
  )
  // ── Initiate: plugin requests a pairing token (no auth) ──────
  .post(
    "/pair/initiate",
    async ({ request, set }) => {
      const token = generatePairingToken()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS)
      const origin = getSiteOrigin(request)

      await db.insert(pluginPairing).values({
        token,
        status: "pending",
        createdAt: now,
        expiresAt,
      })

      return {
        token,
        qrUrl: `${origin}/pair?token=${token}`,
        expiresAt: expiresAt.toISOString(),
      }
    },
    {
      detail: {
        summary: "Initiate Decky plugin pairing",
        description:
          "Creates a short-lived pairing token. The returned qrUrl should be shown as a QR code in the plugin for the user to scan with a logged-in phone.",
      },
    },
  )
  // ── Status: plugin polls until confirmed (no auth, token-gated) ──
  .get(
    "/pair/status/:token",
    async ({ params, set }) => {
      const [row] = await db
        .select()
        .from(pluginPairing)
        .where(eq(pluginPairing.token, params.token))
        .limit(1)

      if (!row) {
        set.status = 404
        return { status: "invalid", error: "Pairing session not found" }
      }

      // Expired and not confirmed
      if (row.expiresAt < new Date() && row.status !== "confirmed") {
        set.status = 410
        return { status: "expired", error: "Pairing session expired" }
      }

      if (row.status === "confirmed" && row.apiKey) {
        // Hand over the plaintext key and clear it from the row so it
        // can only be retrieved once.
        const apiKey = row.apiKey
        await db
          .update(pluginPairing)
          .set({ apiKey: null })
          .where(eq(pluginPairing.token, params.token))

        return {
          status: "confirmed",
          apiKey,
          keyName: "Decky Loader Plugin",
        }
      }

      return { status: "pending" }
    },
    {
      detail: {
        summary: "Check Decky plugin pairing status",
        description:
          "Polled by the plugin until the user confirms on their phone. Returns the plaintext API key once confirmed (one-time retrieval).",
      },
    },
  )
  // ── Confirm: user on phone confirms pairing (session auth) ────
  .post(
    "/pair/confirm",
    async ({ body, request, set }) => {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) {
        set.status = 401
        return { error: "You must be logged in to confirm pairing" }
      }

      const { token } = body
      const [row] = await db
        .select()
        .from(pluginPairing)
        .where(eq(pluginPairing.token, token))
        .limit(1)

      if (!row) {
        set.status = 404
        return { error: "Pairing session not found" }
      }

      if (row.expiresAt < new Date()) {
        set.status = 410
        return { error: "Pairing session expired. Start again on your Deck." }
      }

      if (row.status === "confirmed") {
        set.status = 409
        return { error: "This pairing session has already been confirmed" }
      }

      // Create an API key for this user via Better Auth (server-side).
      // name is required by our api-key plugin config (requireName: true).
      let created: { key: string; id: string } | null = null
      try {
        const result = (await auth.api.createApiKey({
          body: {
            name: "Decky Loader Plugin",
            userId: session.user.id,
          },
        })) as unknown as { key: string; id: string }
        created = { key: result.key, id: result.id }
      } catch (err) {
        console.error("[plugin-pairing] createApiKey failed:", err)
        set.status = 500
        return { error: "Failed to create API key" }
      }

      if (!created || !created.key) {
        set.status = 500
        return { error: "Failed to create API key" }
      }

      // Link the pairing session to the user + key
      await db
        .update(pluginPairing)
        .set({
          userId: session.user.id,
          apiKeyId: created.id,
          apiKey: created.key,
          status: "confirmed",
          confirmedAt: new Date(),
        })
        .where(eq(pluginPairing.token, token))

      return {
        success: true,
        keyName: "Decky Loader Plugin",
      }
    },
    {
      body: t.Object({
        token: t.String(),
      }),
      detail: {
        summary: "Confirm Decky plugin pairing",
        description:
          "Called from the /pair page by a logged-in user. Creates an API key for the account and links it to the pairing token so the plugin can retrieve it.",
      },
    },
  )
  // ── Cleanup: periodically delete expired pairings ────────────
  .post(
    "/pair/cleanup",
    async () => {
      await db
        .delete(pluginPairing)
        .where(lt(pluginPairing.expiresAt, new Date()))
      return { success: true }
    },
    {
      detail: { hide: true },
    },
  )
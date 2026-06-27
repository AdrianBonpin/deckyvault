import { auth } from "@/lib/auth"
import { db } from "@/lib/db/index"
import { user } from "@/lib/db/schema/auth"
import { eq } from "drizzle-orm"
import type { Session } from "better-auth"

type User = typeof auth.$Infer.Session.user

type ApiKeyGuardResult =
  | { ok: true; user: User; session: Session | null; keyId: string }
  | { ok: false; error: string; status: number }

/**
 * Attempts to authenticate a request using an API key from the x-api-key header.
 * Verifies the key via Better Auth and looks up the user from the database.
 */
export async function authenticateWithApiKey(
  requestHeaders: Headers,
): Promise<ApiKeyGuardResult> {
  const apiKey = requestHeaders.get("x-api-key")
  if (!apiKey) {
    return { ok: false, error: "Missing x-api-key header", status: 401 }
  }

  try {
    const result = await auth.api.verifyApiKey({
      body: {
        key: apiKey,
      },
    })

    if (!result.valid || !result.key) {
      const errorMessage = String(result.error?.message ?? "Invalid API key")
      return { ok: false, error: errorMessage, status: 401 }
    }

    const userId = result.key.referenceId
    const keyId = result.key.id

    // Look up the user directly from the database
    const [dbUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!dbUser) {
      return { ok: false, error: "User not found for API key", status: 401 }
    }

    // Build a minimal user object matching Better Auth's Session.user type
    const authedUser: User = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      emailVerified: dbUser.emailVerified,
      image: dbUser.image,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
      role: dbUser.role ?? "user",
      banned: dbUser.banned ?? null,
      banReason: dbUser.banReason ?? null,
      banExpires: dbUser.banExpires ?? null,
    }

    return {
      ok: true,
      user: authedUser,
      session: null,
      keyId,
    }
  } catch (err) {
    console.error("[api-key-guard] API key verification failed:", err)
    return { ok: false, error: "API key verification failed", status: 500 }
  }
}

/**
 * Combined auth guard: first tries session auth (cookie), then falls back
 * to API key auth (x-api-key header). Returns the authenticated user.
 */
export async function requireAuthWithApiKeyFallback(
  requestHeaders: Headers,
): Promise<ApiKeyGuardResult> {
  // Try session auth first
  const session = await auth.api.getSession({ headers: requestHeaders })
  if (session) {
    return {
      ok: true,
      user: session.user,
      session: session.session,
      keyId: "",
    }
  }

  // Fall back to API key
  return authenticateWithApiKey(requestHeaders)
}
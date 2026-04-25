import { auth } from "@/lib/auth"
import type { Session } from "better-auth"

/**
 * Imperative permission guards for use inside route handlers or non-Elysia
 * contexts. For blanket authentication on an Elysia route, prefer the `auth`
 * macro defined in `app/api/[[...slugs]]/route.ts`.
 */

type User = typeof auth.$Infer.Session.user

type GuardResult =
  | { ok: true; user: User; session: Session }
  | { ok: false; error: string; status: number }

export async function requireAuth(headers: Headers): Promise<GuardResult> {
  const session = await auth.api.getSession({ headers })

  if (!session) {
    return { ok: false, error: "Unauthorized", status: 401 }
  }

  return {
    ok: true,
    user: session.user,
    session: session.session,
  }
}

export async function requireRole(
  headers: Headers,
  roles: string[],
): Promise<GuardResult> {
  const authResult = await requireAuth(headers)

  if (!authResult.ok) return authResult

  const userRole = authResult.user.role ?? "user"

  if (!roles.includes(userRole)) {
    return { ok: false, error: "Forbidden", status: 403 }
  }

  return authResult
}

export async function requireAdmin(headers: Headers): Promise<GuardResult> {
  return requireRole(headers, ["admin"])
}

export async function requireContributorOrAdmin(
  headers: Headers,
): Promise<GuardResult> {
  return requireRole(headers, ["contributor", "admin"])
}

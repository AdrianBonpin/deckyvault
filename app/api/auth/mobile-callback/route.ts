import { auth } from "@/lib/auth"
import { NextRequest } from "next/server"

/**
 * Mobile OAuth bridge page.
 *
 * After a social OAuth flow completes in the mobile WebBrowser,
 * Better Auth redirects here with the session cookie set.
 * We extract the session token and redirect to the app's
 * deep link scheme so the mobile app can store the token.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      // No session found — redirect to app with error
      const errorUrl = new URL("deckyvault://auth/callback")
      errorUrl.searchParams.set("error", "session_not_found")
      return Response.redirect(errorUrl.toString())
    }

    const token = session.session.token
    const callbackUrl = new URL("deckyvault://auth/callback")
    callbackUrl.searchParams.set("token", token)

    return Response.redirect(callbackUrl.toString())
  } catch {
    const errorUrl = new URL("deckyvault://auth/callback")
    errorUrl.searchParams.set("error", "callback_error")
    return Response.redirect(errorUrl.toString())
  }
}

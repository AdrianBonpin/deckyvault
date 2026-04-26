import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const authRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
]

export function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname
    const isAuthRoute = authRoutes.some((route) => path.startsWith(route))

    // Check for better-auth session cookie (default name: better-auth.session_token)
    const hasSession = req.cookies
        .getAll()
        .some(
            (cookie) =>
                cookie.name.startsWith("better-auth.") &&
                cookie.value.length > 0,
        )

    // Redirect authenticated users away from auth pages
    if (isAuthRoute && hasSession) {
        return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
}

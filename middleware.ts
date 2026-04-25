import { NextRequest, NextResponse } from "next/server"

const authRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
]

export default async function middleware(req: NextRequest) {
    const path = req.nextUrl.pathname
    const isAuthRoute = authRoutes.some((route) => path.startsWith(route))

    // Check for better-auth session cookie
    const hasSession = req.cookies
        .getAll()
        .some((cookie) => cookie.name.startsWith("better-auth."))

    // Redirect authenticated users away from auth pages
    if (isAuthRoute && hasSession) {
        return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
}

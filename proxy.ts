import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"

const authRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
]

export async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname
    const isAuthRoute = authRoutes.some((route) => path.startsWith(route))

    if (!isAuthRoute) {
        return NextResponse.next()
    }

    // Allow authenticated users to complete the signup wizard.
    // After signUp.email() creates a session, the wizard needs to stay
    // on /signup to complete OTP verification and passkey setup.
    if (path === "/signup") {
        const step = req.nextUrl.searchParams.get("step")
        if (step === "otp" || step === "passkey") {
            return NextResponse.next()
        }
    }

    // Validate session server-side instead of just checking cookie existence.
    // This prevents stale cookies from causing redirect loops.
    const session = await auth.api.getSession({
        headers: req.headers,
    })

    if (session) {
        return NextResponse.redirect(new URL("/", req.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
}

import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { user } from "@/lib/db/schema/auth"
import { eq } from "drizzle-orm"
import { loginEmailSchema } from "@/lib/auth/validation"

// Simple in-memory rate limiter for this endpoint
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
    const now = Date.now()
    const window = 60_000 // 1 minute
    const max = 10 // 10 requests per minute per IP

    const entry = rateLimitStore.get(ip)
    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(ip, { count: 1, resetAt: now + window })
        return true
    }
    if (entry.count >= max) {
        return false
    }
    entry.count++
    return true
}

export async function POST(request: Request) {
    // Rate limit by IP
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() || "unknown"

    if (!checkRateLimit(ip)) {
        return NextResponse.json(
            { error: "Too many requests. Please try again later." },
            { status: 429 },
        )
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        )
    }

    const result = loginEmailSchema.safeParse(body)
    if (!result.success) {
        return NextResponse.json(
            { error: result.error.issues[0].message },
            { status: 400 },
        )
    }

    const { email } = result.data

    const existingUser = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email.toLowerCase()))
        .limit(1)

    return NextResponse.json({ exists: existingUser.length > 0 })
}
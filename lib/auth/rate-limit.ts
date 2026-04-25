import { Elysia } from "elysia"

type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 60 seconds
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  return "unknown"
}

function checkRateLimit(
  key: string,
  window: number,
  max: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + window * 1000
    store.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: max - 1, resetAt }
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

export const rateLimit = (
  window: number = 60,
  max: number = 100,
) =>
  new Elysia({ name: "rate-limit" }).onRequest(({ request, set }) => {
    const ip = getClientIP(request)
    const path = new URL(request.url).pathname
    const key = `${ip}:${path}`

    const result = checkRateLimit(key, window, max)

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
      set.status = 429
      set.headers["Retry-After"] = String(retryAfter)
      return {
        error: "Too many requests",
        retryAfter,
      }
    }

    // These headers are informational — clients can use them to throttle
    set.headers["X-RateLimit-Limit"] = String(max)
    set.headers["X-RateLimit-Remaining"] = String(result.remaining)
    set.headers["X-RateLimit-Reset"] = String(Math.ceil(result.resetAt / 1000))
  })

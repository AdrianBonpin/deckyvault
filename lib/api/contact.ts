import { Elysia, t } from "elysia"

// ── In-memory rate limiter for contact form ──────────────────────
const contactLimiter = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in ms

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of contactLimiter) {
    if (now > entry.resetAt) contactLimiter.delete(key)
  }
}, 5 * 60 * 1000)

function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return "unknown"
}

function checkContactRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = contactLimiter.get(ip)

  if (!entry || now > entry.resetAt) {
    contactLimiter.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return { allowed: true, retryAfter: 0 }
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfter }
  }

  entry.count++
  return { allowed: true, retryAfter: 0 }
}

// ── Discord embed colors by category ─────────────────────────────
const CATEGORY_COLORS: Record<string, number> = {
  bug: 0xe74c3c,           // red
  game_data: 0xf1c40f,     // yellow
  user_report: 0x3498db,   // blue
  feature: 0x2ecc71,       // green
  feedback: 0x95a5a6,      // grey
  database: 0xe74c3c,      // red
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug Report",
  game_data: "Game Data Issue",
  user_report: "User Report",
  feature: "Feature Request",
  feedback: "General Feedback",
  database: "Database Error",
}

const VALID_CATEGORIES = ["bug", "game_data", "user_report", "feature", "feedback", "database"]

export const contactRoutes = new Elysia({ prefix: "/contact" }).post(
  "/",
  async ({ body, request, set }) => {
    const payload = body as {
      category: string
      name?: string
      email?: string
      subject: string
      message: string
      gameUrl?: string
      honeypot?: string
      _timestamp?: string
    }

    // ── Honeypot check ──────────────────────────────────────────
    if (payload.honeypot) {
      set.status = 200
      return { success: true }
    }

    // ── Timing check (must take > 3 seconds) ─────────────────────
    if (payload._timestamp) {
      const start = Number(payload._timestamp)
      if (!isNaN(start) && Date.now() - start < 3000) {
        set.status = 200
        return { success: true }
      }
    }

    // ── Rate limit ──────────────────────────────────────────────
    const ip = getClientIP(request)
    const rateCheck = checkContactRateLimit(ip)
    if (!rateCheck.allowed) {
      set.status = 429
      return { error: "Too many submissions. Please try again later.", retryAfter: rateCheck.retryAfter }
    }

    // ── Validate category ──────────────────────────────────────
    if (!VALID_CATEGORIES.includes(payload.category)) {
      set.status = 400
      return { error: "Invalid category" }
    }

    // ── Validate required fields ────────────────────────────────
    if (!payload.subject || payload.subject.trim().length === 0) {
      set.status = 400
      return { error: "Subject is required" }
    }
    if (payload.subject.length > 200) {
      set.status = 400
      return { error: "Subject must be 200 characters or less" }
    }
    if (!payload.message || payload.message.trim().length === 0) {
      set.status = 400
      return { error: "Message is required" }
    }
    if (payload.message.length > 2000) {
      set.status = 400
      return { error: "Message must be 2000 characters or less" }
    }

    // ── Validate game URL for game_data category ────────────────
    if (payload.category === "game_data" && payload.gameUrl) {
      if (!payload.gameUrl.includes("/game/")) {
        set.status = 400
        return { error: "Game URL must be a valid DeckyVault game link" }
      }
    }

    // ── Validate email format if provided ───────────────────────
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      set.status = 400
      return { error: "Invalid email format" }
    }

    // ── Send to Discord webhook ─────────────────────────────────
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (!webhookUrl) {
      console.error("[Contact] DISCORD_WEBHOOK_URL not configured")
      set.status = 500
      return { error: "Service not configured. Please try again later." }
    }

    const embed = {
      title: `[${CATEGORY_LABELS[payload.category]}] ${payload.subject}`,
      description: payload.message.slice(0, 4096),
      color: CATEGORY_COLORS[payload.category] ?? 0x95a5a6,
      fields: [
        ...(payload.name ? [{ name: "Name", value: payload.name, inline: true }] : []),
        ...(payload.email ? [{ name: "Email", value: payload.email, inline: true }] : []),
        ...(payload.gameUrl ? [{ name: "Game URL", value: payload.gameUrl, inline: false }] : []),
        { name: "IP Hash", value: `\`${ip.slice(0, 8)}...\``, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      })

      if (!res.ok) {
        console.error("[Contact] Discord webhook failed:", res.status, await res.text())
        set.status = 500
        return { error: "Failed to submit. Please try again later." }
      }
    } catch (err) {
      console.error("[Contact] Discord webhook error:", err)
      set.status = 500
      return { error: "Failed to submit. Please try again later." }
    }

    return { success: true }
  },
  {
    body: t.Object({
      category: t.String(),
      name: t.Optional(t.String()),
      email: t.Optional(t.String()),
      subject: t.String(),
      message: t.String(),
      gameUrl: t.Optional(t.String()),
      honeypot: t.Optional(t.String()),
      _timestamp: t.Optional(t.String()),
    }),
  },
)

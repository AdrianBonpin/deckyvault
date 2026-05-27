import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("rate limiting removal", () => {
  const cwd = process.cwd()

  it("lib/auth/rate-limit.ts no longer exports the rateLimit function", () => {
    const filePath = path.join(cwd, "lib", "auth", "rate-limit.ts")
    expect(fs.existsSync(filePath)).toBe(false)
  })

  it("lib/api/app.ts no longer imports or uses rateLimit", () => {
    const content = fs.readFileSync(
      path.join(cwd, "lib", "api", "app.ts"),
      "utf8",
    )
    expect(content).not.toContain('import { rateLimit }')
    expect(content).not.toContain('.use(rateLimit(')
  })

  it("lib/auth.ts has Better Auth rateLimit disabled", () => {
    const content = fs.readFileSync(
      path.join(cwd, "lib", "auth.ts"),
      "utf8",
    )
    const hasRateLimitBlock = content.includes("rateLimit:")
    if (hasRateLimitBlock) {
      expect(content).toContain("enabled: false")
    }
  })

  it("lib/api/contact.ts no longer calls checkContactRateLimit", () => {
    const content = fs.readFileSync(
      path.join(cwd, "lib", "api", "contact.ts"),
      "utf8",
    )
    expect(content).not.toContain("checkContactRateLimit")
  })

  it("lib/api/comments.ts no longer enforces hourly cap", () => {
    const content = fs.readFileSync(
      path.join(cwd, "lib", "api", "comments.ts"),
      "utf8",
    )
    expect(content).not.toContain("hourly limit")
    expect(content).not.toContain('"Duplicate comment detected')
  })

  it("lib/api/performance-submit.ts no longer enforces submission cooldown", () => {
    const content = fs.readFileSync(
      path.join(cwd, "lib", "api", "performance-submit.ts"),
      "utf8",
    )
    expect(content).not.toContain("Submission cooldown")
    expect(content).not.toContain("sixtySecondsAgo")
    expect(content).not.toContain("Please wait before submitting")
  })
})
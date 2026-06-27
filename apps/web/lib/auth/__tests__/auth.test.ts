import { describe, it, expect, beforeAll } from "vitest"

// Auth integration tests require a fully-functional PostgreSQL database with
// the application schema (set via DATABASE_URL). If the env var is missing or
// the DB is unreachable, every test is skipped rather than failing.
let dbUsable = false
let dbHelper: any

if (process.env.DATABASE_URL) {
  try {
    const { db } = await import("@/lib/db/index")
    await db.execute("SELECT 1")
    dbUsable = true
  } catch {
    dbUsable = false
  }
}

describe(dbUsable ? "Better-Auth integration" : "Better-Auth integration (skipped: database not usable)", () => {
  beforeAll(async () => {
    if (!dbUsable) return
    const { getTestHelpers } = await import("@/lib/auth/test")
    dbHelper = await getTestHelpers()
  })

  it("should create a user", async () => {
    if (!dbUsable || !dbHelper) return
    const user = await dbHelper.createUser({ email: "test@example.com" })
    expect(user.email).toBe("test@example.com")
  })

  it("should create a session for a user", async () => {
    if (!dbUsable || !dbHelper) return
    const user = await dbHelper.createUser({ email: "session-test@example.com" })
    await dbHelper.saveUser(user)

    const { session, headers } = await dbHelper.login({ userId: user.id })
    expect(session.userId).toBe(user.id)
    expect(headers.get("cookie")).toBeTruthy()

    await dbHelper.deleteUser(user.id)
  })
})
import { describe, it, expect, beforeAll } from "vitest"
import { getTestHelpers } from "@/lib/auth/test"
import type { TestHelpers } from "better-auth/plugins"

describe("Better-Auth integration", () => {
  let test: TestHelpers

  beforeAll(async () => {
    test = await getTestHelpers()
  })

  it("should create a user", async () => {
    const user = test.createUser({ email: "test@example.com" })
    expect(user.email).toBe("test@example.com")
  })

  it("should create a session for a user", async () => {
    const user = test.createUser({ email: "session-test@example.com" })
    await test.saveUser(user)

    const { session, headers } = await test.login({ userId: user.id })
    expect(session.userId).toBe(user.id)
    expect(headers.get("cookie")).toBeTruthy()

    await test.deleteUser(user.id)
  })
})

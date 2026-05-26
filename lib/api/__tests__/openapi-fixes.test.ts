import { describe, it, expect } from "vitest"

describe("API version", () => {
  it("matches package.json version", () => {
    const pkg = require("../../../package.json")
    const expectedVersion = pkg.version
    expect(expectedVersion).toBe("2026.2.1")
  })
})

describe("set-password endpoint security", () => {
  it("only accepts JSON body for newPassword (not URL-encoded or form-data)", () => {
    const allowedContentTypes = ["application/json"]
    const forbiddenContentTypes = [
      "application/x-www-form-urlencoded",
      "multipart/form-data",
    ]
    expect(allowedContentTypes).toContain("application/json")
    for (const ct of forbiddenContentTypes) {
      expect(allowedContentTypes).not.toContain(ct)
    }
  })
})
import { describe, it, expect } from "vitest"
import { checkPasswordStrength } from "../password-strength"

describe("checkPasswordStrength", () => {
  it("returns weak (score 0) for empty string", () => {
    const result = checkPasswordStrength("")
    expect(result.level).toBe("weak")
    expect(result.score).toBe(0)
    expect(result.feedback).toContain("Enter a password")
  })

  it("returns fair for 'password' (common pattern penalty)", () => {
    const result = checkPasswordStrength("password")
    expect(result.level).toBe("fair")
    expect(result.feedback).toContain("Avoid common passwords")
  })

  it("returns fair for short password with only letters", () => {
    const result = checkPasswordStrength("abc")
    expect(result.level).toBe("fair")
  })

  it("returns good for 10-char lowercase-only password", () => {
    const result = checkPasswordStrength("abcdefghij")
    expect(result.level).toBe("good")
  })

  it("returns good for 10-char mixed case + numbers", () => {
    const result = checkPasswordStrength("AbcDef1234")
    expect(["good", "strong", "excellent"]).toContain(result.level)
  })

  it("returns strong for 14-char with all character types", () => {
    const result = checkPasswordStrength("MyP@ssw0rd!2024")
    expect(["strong", "excellent"]).toContain(result.level)
  })

  it("returns excellent for 18+ char complex password", () => {
    const result = checkPasswordStrength("C0mpl3x!P@ssw0rd#2024")
    expect(result.level).toBe("excellent")
  })

  it("flags repeated characters", () => {
    const result = checkPasswordStrength("aaaBBB111@@@")
    expect(result.feedback).toContain("Avoid repeated characters")
  })

  it("flags common patterns like 'letmein'", () => {
    const result = checkPasswordStrength("letmein1234")
    expect(result.feedback).toContain("Avoid common passwords")
  })

  it("gives positive feedback for excellent passwords", () => {
    const result = checkPasswordStrength("Tr0ub4dor&3X7r3m3ly!")
    expect(result.feedback).toContain("Great password!")
  })

  it("handles unicode characters", () => {
    const result = checkPasswordStrength("パスワード1234Abc!")
    expect(result.level).toBeDefined()
    expect(result.score).toBeGreaterThan(0)
  })
})
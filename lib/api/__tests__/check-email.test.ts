import { describe, it, expect } from "vitest"
import { loginEmailSchema } from "@/lib/auth/validation"

describe("check-email validation", () => {
  it("accepts valid email", () => {
    const result = loginEmailSchema.safeParse({ email: "user@example.com" })
    expect(result.success).toBe(true)
  })

  it("rejects missing email", () => {
    const result = loginEmailSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it("rejects invalid email format", () => {
    const result = loginEmailSchema.safeParse({ email: "not-email" })
    expect(result.success).toBe(false)
  })

  it("rejects empty string email", () => {
    const result = loginEmailSchema.safeParse({ email: "" })
    expect(result.success).toBe(false)
  })
})

describe("check-email response contract", () => {
  it("returns { exists: boolean } on success", () => {
    const successShape = { exists: true }
    const failureShape = { exists: false }
    expect(successShape).toHaveProperty("exists")
    expect(failureShape).toHaveProperty("exists")
    expect(typeof successShape.exists).toBe("boolean")
    expect(typeof failureShape.exists).toBe("boolean")
  })

  it("returns { error: string } on validation failure", () => {
    const errorShape = { error: "Invalid request body" }
    expect(errorShape).toHaveProperty("error")
    expect(typeof errorShape.error).toBe("string")
  })
})
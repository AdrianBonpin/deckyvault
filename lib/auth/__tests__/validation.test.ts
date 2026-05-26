import { describe, it, expect } from "vitest"
import {
  loginEmailSchema,
  loginSchema,
  signupSchema,
  otpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validation"

describe("loginEmailSchema", () => {
  it("accepts a valid email", () => {
    const result = loginEmailSchema.safeParse({ email: "user@example.com" })
    expect(result.success).toBe(true)
  })

  it("rejects empty string", () => {
    const result = loginEmailSchema.safeParse({ email: "" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email format", () => {
    const result = loginEmailSchema.safeParse({ email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  it("rejects missing email field", () => {
    const result = loginEmailSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Password is required")
    }
  })

  it("rejects missing password field", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" })
    expect(result.success).toBe(false)
  })
})

describe("signupSchema", () => {
  it("accepts valid name, email, and password (≥10 chars)", () => {
    const result = signupSchema.safeParse({
      name: "Test User",
      email: "user@example.com",
      password: "abcdefghij",
    })
    expect(result.success).toBe(true)
  })

  it("rejects short password (<10 chars)", () => {
    const result = signupSchema.safeParse({
      name: "Test User",
      email: "user@example.com",
      password: "short",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain("at least 10 characters")
    }
  })

  it("rejects empty name", () => {
    const result = signupSchema.safeParse({
      name: "",
      email: "user@example.com",
      password: "abcdefghij",
    })
    expect(result.success).toBe(false)
  })

  it("rejects name longer than 100 chars", () => {
    const result = signupSchema.safeParse({
      name: "a".repeat(101),
      email: "user@example.com",
      password: "abcdefghij",
    })
    expect(result.success).toBe(false)
  })
})

describe("otpSchema", () => {
  it("accepts exactly 6 digits", () => {
    const result = otpSchema.safeParse({ otp: "123456" })
    expect(result.success).toBe(true)
  })

  it("rejects 5 digits", () => {
    const result = otpSchema.safeParse({ otp: "12345" })
    expect(result.success).toBe(false)
  })

  it("rejects 7 digits", () => {
    const result = otpSchema.safeParse({ otp: "1234567" })
    expect(result.success).toBe(false)
  })

  it("accepts any 6-char string (schema only validates length)", () => {
    const result = otpSchema.safeParse({ otp: "abc123" })
    expect(result.success).toBe(true)
  })
})

describe("forgotPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "user@example.com" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "bad" })
    expect(result.success).toBe(false)
  })
})

describe("resetPasswordSchema", () => {
  it("accepts matching passwords with valid OTP", () => {
    const result = resetPasswordSchema.safeParse({
      otp: "123456",
      newPassword: "abcdefghij",
      confirmPassword: "abcdefghij",
    })
    expect(result.success).toBe(true)
  })

  it("rejects mismatched passwords", () => {
    const result = resetPasswordSchema.safeParse({
      otp: "123456",
      newPassword: "abcdefghij",
      confirmPassword: "different",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Passwords do not match")
    }
  })

  it("rejects short new password", () => {
    const result = resetPasswordSchema.safeParse({
      otp: "123456",
      newPassword: "short",
      confirmPassword: "short",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty confirm password", () => {
    const result = resetPasswordSchema.safeParse({
      otp: "123456",
      newPassword: "abcdefghij",
      confirmPassword: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects short OTP", () => {
    const result = resetPasswordSchema.safeParse({
      otp: "12345",
      newPassword: "abcdefghij",
      confirmPassword: "abcdefghij",
    })
    expect(result.success).toBe(false)
  })
})
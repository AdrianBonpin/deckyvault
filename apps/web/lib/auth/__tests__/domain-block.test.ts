import { describe, it, expect } from "vitest"
import { isDeckyVaultEmail, DOMAIN_BLOCK_ERROR } from "../domain-block"

describe("isDeckyVaultEmail", () => {
  it("returns true for a @deckyvault.xyz email (lowercase)", () => {
    expect(isDeckyVaultEmail("user@deckyvault.xyz")).toBe(true)
  })

  it("returns true for a @deckyvault.xyz email (mixed case)", () => {
    expect(isDeckyVaultEmail("User@DeckyVault.xyz")).toBe(true)
  })

  it("returns true for a @deckyvault.xyz email with plus addressing", () => {
    expect(isDeckyVaultEmail("user+tag@deckyvault.xyz")).toBe(true)
  })

  it("returns true for a @deckyvault.xyz email with surrounding whitespace", () => {
    expect(isDeckyVaultEmail("  admin@deckyvault.xyz  ")).toBe(true)
  })

  it("returns false for a @gmail.com email", () => {
    expect(isDeckyVaultEmail("user@gmail.com")).toBe(false)
  })

  it("returns false for a @example.com email", () => {
    expect(isDeckyVaultEmail("user@example.com")).toBe(false)
  })

  it("returns false for a subdomain like @mail.deckyvault.xyz", () => {
    expect(isDeckyVaultEmail("user@mail.deckyvault.xyz")).toBe(false)
  })

  it("returns false for an empty string", () => {
    expect(isDeckyVaultEmail("")).toBe(false)
  })

  it("returns false for a string without @", () => {
    expect(isDeckyVaultEmail("deckyvault.xyz")).toBe(false)
  })

  it("returns true for a .DECKYVAULT.XYZ email (uppercase domain)", () => {
    expect(isDeckyVaultEmail("admin@DECKYVAULT.XYZ")).toBe(true)
  })
})

describe("DOMAIN_BLOCK_ERROR", () => {
  it("is a non-empty string", () => {
    expect(DOMAIN_BLOCK_ERROR).toBeTruthy()
    expect(typeof DOMAIN_BLOCK_ERROR).toBe("string")
  })
})
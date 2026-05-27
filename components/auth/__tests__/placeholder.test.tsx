import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("auth form email placeholder text", () => {
  it("all auth forms use you@deckyvault.xyz not you@example.com", () => {
    const files = [
      "components/auth/signup-form-step.tsx",
      "components/auth/login-form.tsx",
      "components/auth/forgot-password-form.tsx",
    ]

    for (const file of files) {
      const fullPath = path.join(process.cwd(), file)
      const content = fs.readFileSync(fullPath, "utf8")
      expect(content).not.toContain('"you@example.com"')
      expect(content).toContain('"you@deckyvault.xyz"')
    }
  })
})

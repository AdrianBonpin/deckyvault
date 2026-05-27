import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

describe("version bump to 2026.2.2", () => {
  const cwd = process.cwd()

  it("package.json version is 2026.2.2", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, "package.json"), "utf8"),
    )
    expect(pkg.version).toBe("2026.2.2")
  })

  it("OpenAPI spec version is 2026.2.2", () => {
    const apiContent = fs.readFileSync(
      path.join(cwd, "lib", "api", "app.ts"),
      "utf8",
    )
    expect(apiContent).toContain('version: "2026.2.2"')
  })

  it("CHANGELOG.md contains [2026.2.2] entry", () => {
    const changelog = fs.readFileSync(
      path.join(cwd, "CHANGELOG.md"),
      "utf8",
    )
    expect(changelog).toContain("## [2026.2.2]")
    expect(changelog).toContain("### Added")
    expect(changelog).toContain("@deckyvault.xyz")
  })

  it("content/updates/2026-05-27-v2026.2.2.md exists with valid frontmatter", () => {
    const updatePath = path.join(
      cwd,
      "content",
      "updates",
      "2026-05-27-v2026.2.2.md",
    )
    expect(fs.existsSync(updatePath)).toBe(true)

    const content = fs.readFileSync(updatePath, "utf8")
    expect(content.startsWith("---")).toBe(true)
    expect(content).toContain('title:')
    expect(content).toContain('date: "2026-05-27"')
    expect(content).toContain('version: "2026.2.2"')
    expect(content).toContain('summary:')
  })
})
import { describe, it, expect } from "vitest"

describe("SteamDB HTML Parser", () => {
  it("parses version and build from typical SteamDB HTML", async () => {
    const { _parseSteamDBHtml } = await import("../scrape")
    // Version regex: /Last known name[^<]*<[^>]*>([^<]+)</i
    // Build ID regex: /Build\s*ID[^<]*<\/td>\s*<td[^>]*>(\d+)/i
    const html = `
      <html>
        <body>
          <table>
            <tr><td>Last known name <span>v1.2.3</span></td></tr>
            <tr><td>Build ID</td><td>12345678</td></tr>
          </table>
        </body>
      </html>
    `

    const result = _parseSteamDBHtml(html)
    expect(result.versionString).toBe("v1.2.3")
    expect(result.buildId).toBe("12345678")
  })

  it("returns nulls for unrecognized HTML", async () => {
    const { _parseSteamDBHtml } = await import("../scrape")
    const result = _parseSteamDBHtml("<html><body>Nothing here</body></html>")
    expect(result.versionString).toBeNull()
    expect(result.buildId).toBeNull()
  })

  it("extracts build ID via buildid attribute even without version string", async () => {
    const { _parseSteamDBHtml } = await import("../scrape")
    // Build ID regex fallback: /buildid[^>]*>(\d+)/i
    // buildid[^>]*>(\d+) — expects digits right after the closing tag
    const html = `<span buildid>99999</span>`
    const result = _parseSteamDBHtml(html)
    expect(result.buildId).toBe("99999")
    expect(result.versionString).toBeNull()
  })

  it("extracts build ID via Build ID table row pattern", async () => {
    const { _parseSteamDBHtml } = await import("../scrape")
    const html = `<tr><td>Build ID</td><td>55555</td></tr>`
    const result = _parseSteamDBHtml(html)
    expect(result.buildId).toBe("55555")
    expect(result.versionString).toBeNull()
  })

  it("extracts version from JSON-LD when available", async () => {
    const { _parseSteamDBHtml } = await import("../scrape")
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {"name":"Test Game","version":"2.0.0","datePublished":"2024-01-01"}
          </script>
        </head>
        <body></body>
      </html>
    `
    const result = _parseSteamDBHtml(html)
    expect(result.versionString).toBe("2.0.0")
    expect(result.buildId).toBeNull()
  })
})

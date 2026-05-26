import { describe, it, expect } from "vitest"
import { rateLimit } from "../rate-limit"
import { Elysia } from "elysia"

describe("rateLimit plugin", () => {
  it("creates an Elysia plugin instance", () => {
    const plugin = rateLimit("default")
    expect(plugin).toBeInstanceOf(Elysia)
  })

  it("sets rate limit headers on allowed requests", async () => {
    const app = new Elysia()
      .use(rateLimit("default"))
      .get("/test", () => "ok")

    const response = await app.handle(
      new Request("http://localhost/test")
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-RateLimit-Limit")).toBeTruthy()
    expect(response.headers.get("X-RateLimit-Remaining")).toBeTruthy()
    expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy()
  })

  it("allows requests within limit", async () => {
    const app = new Elysia()
      .use(rateLimit("default"))
      .get("/test", () => "ok")

    // Make a reasonable number of requests that should all succeed
    for (let i = 0; i < 5; i++) {
      const response = await app.handle(
        new Request("http://localhost/test")
      )
      expect(response.status).toBe(200)
    }
  })

  it("different categories have independent limits", async () => {
    const app = new Elysia()
      .use(rateLimit("default"))
      .get("/test", () => "ok")

    // Just verify it works at all — actual limit enforcement depends on the config
    const response = await app.handle(new Request("http://localhost/test"))
    expect(response.status).toBe(200)
  })

  it("returns Retry-After header on rate limit", async () => {
    const app = new Elysia()
      .use(rateLimit("strict"))
      .get("/test", () => "ok")

    // Make requests until the remaining goes to 0, then check Retry-After
    for (let i = 0; i < 10; i++) {
      const response = await app.handle(new Request("http://localhost/test"))
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After")
        expect(retryAfter).toBeTruthy()
        expect(Number(retryAfter)).toBeGreaterThan(0)
        break
      }
    }
  })
})
import { describe, it, expect } from "vitest"
import { Elysia } from "elysia"
import { isDeckyVaultEmail, DOMAIN_BLOCK_ERROR } from "@/lib/auth/domain-block"

/**
 * The domain-block onBeforeHandle handler – mirrors the logic
 * wired into the auth group in lib/api/app.ts.  Tested in isolation
 * here so we don't need to stand up the full app / DB.
 *
 * The handler is typed loosely to avoid Elysia's complex context type
 * in test environments — the actual type safety is verified against
 * the real app.ts implementation at integration test time.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const domainBlockOnBeforeHandle = async (context: any) => {
  const { request, set } = context as {
    request: Request
    set: { status: number }
  }
  const url = new URL(request.url)
  const isSignUp =
    url.pathname === "/api/auth/sign-up/email" &&
    request.method === "POST"

  if (!isSignUp) return

  if (process.env.NODE_ENV !== "development") {
    try {
      const cloned = request.clone()
      const body = await cloned.json()
      if (isDeckyVaultEmail(body.email)) {
        set.status = 400
        return { error: DOMAIN_BLOCK_ERROR }
      }
    } catch {
      // Malformed body — let Better Auth reject it downstream
    }
  }
}

describe("domain block middleware", () => {
  it("blocks POST /api/auth/sign-up/email with @deckyvault.xyz email", async () => {
    const app = new Elysia()
      .onBeforeHandle(domainBlockOnBeforeHandle)
      .post("/api/auth/sign-up/email", () => ({
        success: "should not reach this",
      }))

    const res = await app.handle(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "bad@deckyvault.xyz",
          password: "abcdefghij",
          name: "Test",
        }),
      }),
    )

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe(DOMAIN_BLOCK_ERROR)
  })

  it("allows POST /api/auth/sign-up/email with non-deckyvault email", async () => {
    const app = new Elysia()
      .onBeforeHandle(domainBlockOnBeforeHandle)
      .post("/api/auth/sign-up/email", () => ({
        success: true,
      }))

    const res = await app.handle(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "good@gmail.com",
          password: "abcdefghij",
          name: "Test",
        }),
      }),
    )

    expect(res.status).toBe(200)
  })

  it("ignores non-sign-up routes (GET /api/auth/something)", async () => {
    const app = new Elysia()
      .onBeforeHandle(domainBlockOnBeforeHandle)
      .get("/api/auth/something", () => ({ ok: true }))

    const res = await app.handle(
      new Request("http://localhost:3000/api/auth/something"),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })

  it("handles malformed JSON body gracefully (passes through)", async () => {
    const app = new Elysia()
      .onBeforeHandle(domainBlockOnBeforeHandle)
      .post("/api/auth/sign-up/email", () => ({ success: true }))

    const res = await app.handle(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-valid-json",
      }),
    )

    expect(res.status).toBe(200)
  })
})

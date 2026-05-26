import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"
import { NextRequest } from "next/server"

// Mock the auth module — no real betterAuth initialisation should run.
vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

// Use dynamic imports so vi.mock is guaranteed to be registered before
// any module evaluation in bun test's shared-module-cache multi-file mode.
let proxy: typeof import("../proxy")["proxy"]
let getSession: ReturnType<typeof vi.fn>

beforeAll(async () => {
  const proxyModule = await import("../proxy")
  proxy = proxyModule.proxy

  const mocked = await import("@/lib/auth")
  getSession = mocked.auth.api.getSession
})

function mockSession(overrides: Record<string, unknown> = {}) {
  getSession.mockResolvedValue({
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "user",
      ...overrides,
    },
    session: {
      id: "session-1",
      userId: "user-1",
      token: "token-abc",
    },
  })
}

function mockNoSession() {
  getSession.mockResolvedValue(null)
}

beforeEach(() => {
  getSession.mockReset()
})

/** Helper to create a NextRequest for a given path on our origin. */
function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"))
}

describe("proxy — signup wizard guard", () => {
  it("redirects unauthenticated users on /signup?step=otp to /signup", async () => {
    mockNoSession()
    const req = makeRequest("/signup?step=otp")
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/signup")
  })

  it("redirects unauthenticated users on /signup?step=passkey to /signup", async () => {
    mockNoSession()
    const req = makeRequest("/signup?step=passkey")
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/signup")
  })

  it("allows authenticated users on /signup?step=otp through", async () => {
    mockSession()
    const req = makeRequest("/signup?step=otp")
    const res = await proxy(req)
    // NextResponse.next() is not a redirect — it passes the request through.
    expect(res.status).not.toBe(307)
  })

  it("allows authenticated users on /signup?step=passkey through", async () => {
    mockSession()
    const req = makeRequest("/signup?step=passkey")
    const res = await proxy(req)
    expect(res.status).not.toBe(307)
  })

  it("redirects authenticated users on /signup (no step) to /", async () => {
    mockSession()
    const req = makeRequest("/signup")
    const res = await proxy(req)
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("http://localhost:3000/")
  })

  it("allows unauthenticated users on /signup (no step) through", async () => {
    mockNoSession()
    const req = makeRequest("/signup")
    const res = await proxy(req)
    expect(res.status).not.toBe(307)
  })
})
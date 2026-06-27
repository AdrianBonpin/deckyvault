import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest"

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
let requireAuth: typeof import("../guard")["requireAuth"]
let requireRole: typeof import("../guard")["requireRole"]
let requireAdmin: typeof import("../guard")["requireAdmin"]
let requireContributorOrAdmin: typeof import("../guard")["requireContributorOrAdmin"]
let requireModeratorOrAdmin: typeof import("../guard")["requireModeratorOrAdmin"]
let getSession: ReturnType<typeof vi.fn>

beforeAll(async () => {
  const guard = await import("../guard")
  requireAuth = guard.requireAuth
  requireRole = guard.requireRole
  requireAdmin = guard.requireAdmin
  requireContributorOrAdmin = guard.requireContributorOrAdmin
  requireModeratorOrAdmin = guard.requireModeratorOrAdmin

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

describe("requireAuth", () => {
  it("returns ok with user and session when authenticated", async () => {
    mockSession()
    const result = await requireAuth(new Headers())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.id).toBe("user-1")
      expect(result.session.id).toBe("session-1")
    }
  })

  it("returns error 401 when not authenticated", async () => {
    mockNoSession()
    const result = await requireAuth(new Headers())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
      expect(result.error).toBe("Unauthorized")
    }
  })
})

describe("requireRole", () => {
  it("allows user with matching role", async () => {
    mockSession({ role: "admin" })
    const result = await requireRole(new Headers(), ["admin"])
    expect(result.ok).toBe(true)
  })

  it("denies user with non-matching role (403)", async () => {
    mockSession({ role: "user" })
    const result = await requireRole(new Headers(), ["admin"])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
      expect(result.error).toBe("Forbidden")
    }
  })

  it("returns 401 when not authenticated", async () => {
    mockNoSession()
    const result = await requireRole(new Headers(), ["admin"])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(401)
    }
  })

  it("defaults to 'user' role when role is null", async () => {
    mockSession({ role: null })
    const result = await requireRole(new Headers(), ["user"])
    expect(result.ok).toBe(true)
  })
})

describe("requireAdmin", () => {
  it("allows admin user", async () => {
    mockSession({ role: "admin" })
    const result = await requireAdmin(new Headers())
    expect(result.ok).toBe(true)
  })

  it("denies non-admin user (403)", async () => {
    mockSession({ role: "moderator" })
    const result = await requireAdmin(new Headers())
    expect(result.ok).toBe(false)
  })
})

describe("requireContributorOrAdmin", () => {
  it("allows contributor", async () => {
    mockSession({ role: "contributor" })
    const result = await requireContributorOrAdmin(new Headers())
    expect(result.ok).toBe(true)
  })

  it("allows admin", async () => {
    mockSession({ role: "admin" })
    const result = await requireContributorOrAdmin(new Headers())
    expect(result.ok).toBe(true)
  })

  it("denies regular user", async () => {
    mockSession({ role: "user" })
    const result = await requireContributorOrAdmin(new Headers())
    expect(result.ok).toBe(false)
  })
})

describe("requireModeratorOrAdmin", () => {
  it("allows moderator", async () => {
    mockSession({ role: "moderator" })
    const result = await requireModeratorOrAdmin(new Headers())
    expect(result.ok).toBe(true)
  })

  it("allows admin", async () => {
    mockSession({ role: "admin" })
    const result = await requireModeratorOrAdmin(new Headers())
    expect(result.ok).toBe(true)
  })

  it("denies contributor", async () => {
    mockSession({ role: "contributor" })
    const result = await requireModeratorOrAdmin(new Headers())
    expect(result.ok).toBe(false)
  })
})
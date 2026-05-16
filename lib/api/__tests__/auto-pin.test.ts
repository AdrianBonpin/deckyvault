import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/db/index"
import { checkAndAutoPin } from "@/lib/api/auto-pin"
import { performanceEntries } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// Mock the database
vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
  },
}))

function setupMockEntry(overrides: {
  id?: string
  isPinned?: boolean
  isRemoved?: boolean
  upvotes?: number
  downvotes?: number
}) {
  const entry = {
    id: overrides.id ?? "test-entry-1",
    isPinned: overrides.isPinned ?? false,
    isRemoved: overrides.isRemoved ?? false,
    upvotes: overrides.upvotes ?? 0,
    downvotes: overrides.downvotes ?? 0,
  }

  // Mock select chain: .select(...).from(...).where(...).limit(...)
  const limitMock = vi.fn().mockResolvedValue([entry])
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
  const fromMock = vi.fn().mockReturnValue({ where: whereMock })
  const selectMock = vi.fn().mockReturnValue({ from: fromMock })
  ;(db.select as any).mockReturnValue({ from: fromMock })

  // Mock update chain: .update(...).set(...).where(...)
  const updateWhereMock = vi.fn().mockResolvedValue(undefined)
  const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock })
  const updateMock = vi.fn().mockReturnValue({ set: updateSetMock })
  ;(db.update as any).mockImplementation(updateMock)

  return entry
}

describe("checkAndAutoPin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("pins an entry with 8 upvotes and 2 downvotes (80% approval, 10 total)", async () => {
    setupMockEntry({ upvotes: 8, downvotes: 2 })

    const result = await checkAndAutoPin("test-entry-1")
    expect(result).toBe(true)
  })

  it("does NOT pin an entry with 7 upvotes and 1 downvote (< 8 absolute upvotes)", async () => {
    setupMockEntry({ upvotes: 7, downvotes: 1 })

    const result = await checkAndAutoPin("test-entry-1")
    expect(result).toBe(false)
  })

  it("does NOT pin an entry with 8 upvotes and 0 downvotes (< 10 total votes)", async () => {
    setupMockEntry({ upvotes: 8, downvotes: 0 })

    const result = await checkAndAutoPin("test-entry-1")
    expect(result).toBe(false)
  })

  it("does NOT pin an entry with 6 upvotes and 4 downvotes (60% approval, below 80%)", async () => {
    setupMockEntry({ upvotes: 6, downvotes: 4 })

    const result = await checkAndAutoPin("test-entry-1")
    expect(result).toBe(false)
  })

  it("does NOT pin an already-pinned entry", async () => {
    setupMockEntry({ isPinned: true, upvotes: 20, downvotes: 0 })

    const result = await checkAndAutoPin("test-entry-1")
    expect(result).toBe(false)
  })

  it("does NOT pin a removed entry", async () => {
    setupMockEntry({ isRemoved: true, upvotes: 20, downvotes: 0 })

    const result = await checkAndAutoPin("test-entry-1")
    expect(result).toBe(false)
  })

  it("pins an entry with 20 upvotes and 5 downvotes (80% approval exactly)", async () => {
    setupMockEntry({ upvotes: 20, downvotes: 5 })

    const result = await checkAndAutoPin("test-entry-1")
    expect(result).toBe(true)
  })

  it("does NOT pin when entry is not found", async () => {
    // Mock select returning empty array
    const limitMock = vi.fn().mockResolvedValue([])
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    const selectMock = vi.fn().mockReturnValue({ from: fromMock })
    ;(db.select as any).mockReturnValue({ from: fromMock })
    ;(db.update as any) = vi.fn()

    const result = await checkAndAutoPin("nonexistent")
    expect(result).toBe(false)
  })
})

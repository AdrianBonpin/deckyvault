import { db } from "@/lib/db/index"
import { performanceEntries } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

/**
 * Auto-pin check: an entry is eligible for auto-pinning when:
 * 1. NOT already pinned (isPinned = false)
 * 2. NOT removed (isRemoved = false)
 * 3. Total votes >= 10 (upvotes + downvotes)
 * 4. Approval ratio >= 0.80 (upvotes / total_votes)
 * 5. Absolute upvotes >= 8
 */
const AUTO_PIN_MIN_TOTAL_VOTES = 10
const AUTO_PIN_MIN_APPROVAL_RATIO = 0.80
const AUTO_PIN_MIN_UPVOTES = 8

export async function checkAndAutoPin(entryId: string): Promise<boolean> {
  const [entry] = await db
    .select({
      id: performanceEntries.id,
      isPinned: performanceEntries.isPinned,
      isRemoved: performanceEntries.isRemoved,
      upvotes: performanceEntries.upvotes,
      downvotes: performanceEntries.downvotes,
    })
    .from(performanceEntries)
    .where(eq(performanceEntries.id, entryId))
    .limit(1)

  if (!entry) return false
  if (entry.isPinned) return false
  if (entry.isRemoved) return false

  const totalVotes = entry.upvotes + entry.downvotes
  if (totalVotes < AUTO_PIN_MIN_TOTAL_VOTES) return false
  if (entry.upvotes < AUTO_PIN_MIN_UPVOTES) return false

  const approvalRatio = entry.upvotes / totalVotes
  if (approvalRatio < AUTO_PIN_MIN_APPROVAL_RATIO) return false

  // Conditions met — auto-pin
  await db
    .update(performanceEntries)
    .set({
      isPinned: true,
      pinnedAt: new Date(),
    })
    .where(eq(performanceEntries.id, entryId))

  return true
}
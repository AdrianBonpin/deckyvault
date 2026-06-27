import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { generateSlug } from "@/lib/utils/slug"
import { ne, isNull, isNotNull, and, eq } from "drizzle-orm"

async function backfillSlugs() {
  const nonSteamGames = await db
    .select({ id: games.id, title: games.title })
    .from(games)
    .where(and(ne(games.source, "steam"), isNull(games.slug)))

  console.log(`Found ${nonSteamGames.length} non-Steam games without slugs`)

  const usedSlugs = new Set<string>()
  const existing = await db
    .select({ slug: games.slug })
    .from(games)
    .where(isNotNull(games.slug))
  for (const row of existing) {
    if (row.slug) usedSlugs.add(row.slug)
  }

  let updated = 0
  let errors = 0
  for (const game of nonSteamGames) {
    let slug = generateSlug(game.title)
    if (!slug) {
      slug = `game-${game.id.slice(0, 8)}`
    }
    let candidate = slug
    let suffix = 2
    while (usedSlugs.has(candidate)) {
      candidate = `${slug}-${suffix}`
      suffix++
    }
    usedSlugs.add(candidate)
    try {
      await db.update(games).set({ slug: candidate }).where(eq(games.id, game.id))
      updated++
    } catch (err) {
      console.error(`Failed to update ${game.title} (${game.id}):`, err)
      errors++
    }
  }
  console.log(`Backfill complete: ${updated} updated, ${errors} errors`)
}

backfillSlugs()
  .then(() => process.exit(0))
  .catch((err) => { console.error("Backfill failed:", err); process.exit(1) })
import { notFound } from "next/navigation"
import { db } from "@/lib/db/index"
import { games, gameVersions } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { GameEntryWizard } from "@/components/wizard/game-entry-wizard"

export const metadata = {
  title: "Submit Benchmark",
}

export default async function SubmitBenchmarkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Resolve game
  const isNumeric = /^\d+$/.test(id)
  let game

  if (isNumeric) {
    const rows = await db
      .select()
      .from(games)
      .where(eq(games.steamAppId, Number(id)))
      .limit(1)
    game = rows[0]
  } else {
    const rows = await db
      .select()
      .from(games)
      .where(eq(games.id, id))
      .limit(1)
    game = rows[0]
  }

  if (!game) {
    notFound()
  }

  // Get or create the latest game version
  let [version] = await db
    .select()
    .from(gameVersions)
    .where(
      eq(gameVersions.gameId, game.id),
    )
    .orderBy(sql`${gameVersions.createdAt} DESC`)
    .limit(1)

  // Create a default version if none exists
  if (!version) {
    [version] = await db
      .insert(gameVersions)
      .values({
        gameId: game.id,
        isLatest: true,
      })
      .returning()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Submit Benchmark</h1>
        <p className="text-sm text-text/60">
          Submit performance data for <span className="text-text font-medium">{game.title}</span>
        </p>
      </div>

      <GameEntryWizard
        gameId={game.id}
        gameVersionId={version.id}
      />
    </div>
  )
}

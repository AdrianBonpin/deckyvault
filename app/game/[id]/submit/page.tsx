import { notFound } from "next/navigation"
import { db } from "@/lib/db/index"
import { games, gameVersions, performanceEntries } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { GameEntryWizard } from "@/components/wizard/game-entry-wizard"

// This page needs live data — skip static generation at build time
export const dynamic = "force-dynamic"

export const metadata = {
  title: "Submit Benchmark",
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ edit?: string }>
}

export default async function SubmitBenchmarkPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params
  const { edit } = await searchParams

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

  // If editing, fetch the existing performance entry
  let editEntry = null
  if (edit) {
    const [entry] = await db
      .select()
      .from(performanceEntries)
      .where(eq(performanceEntries.id, edit))
      .limit(1)
    editEntry = entry ?? null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">
          {editEntry ? "Edit Benchmark" : "Submit Benchmark"}
        </h1>
        <p className="text-sm text-text/60">
          {editEntry ? "Update your performance data for" : "Submit performance data for"}{" "}
          <span className="text-text font-medium">{game.title}</span>
        </p>
      </div>

      <GameEntryWizard
        gameId={game.id}
        gameVersionId={version.id}
        editEntry={editEntry}
      />
    </div>
  )
}

import { notFound } from "next/navigation"
import { db } from "@/lib/db/index"
import { games, gameVersions, performanceEntries, gamePlatformSupport, entryScreenshots } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { GameEntryWizard, type GameVersionInfo } from "@/components/wizard/game-entry-wizard"
import { getR2PublicUrl } from "@/lib/storage/r2-client"

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

  // Fetch all game versions for version selection
  const allVersions = await db
    .select({
      id: gameVersions.id,
      versionString: gameVersions.versionString,
      buildId: gameVersions.buildId,
      isLatest: gameVersions.isLatest,
    })
    .from(gameVersions)
    .where(eq(gameVersions.gameId, game.id))
    .orderBy(sql`${gameVersions.createdAt} DESC`)

  // Create a default version if none exists
  if (allVersions.length === 0) {
    const [newVersion] = await db
      .insert(gameVersions)
      .values({
        gameId: game.id,
        isLatest: true,
      })
      .returning()
    allVersions.push({
      id: newVersion.id,
      versionString: newVersion.versionString,
      buildId: newVersion.buildId,
      isLatest: newVersion.isLatest,
    })
  }

  // If editing, fetch the existing performance entry
  let editEntry: any = null
  if (edit) {
    const [entry] = await db
      .select()
      .from(performanceEntries)
      .where(eq(performanceEntries.id, edit))
      .limit(1)

    if (entry) {
      const publicUrl = getR2PublicUrl()
      const screenshots = await db
        .select({
          id: entryScreenshots.id,
          storageKey: entryScreenshots.storageKey,
          orderIndex: entryScreenshots.orderIndex,
          width: entryScreenshots.width,
          height: entryScreenshots.height,
        })
        .from(entryScreenshots)
        .where(eq(entryScreenshots.entryId, entry.id))
        .orderBy(entryScreenshots.orderIndex)

      editEntry = {
        ...entry,
        screenshots: screenshots.map((ss) => ({
          id: ss.id,
          url: `${publicUrl}/${ss.storageKey}`,
          width: ss.width,
          height: ss.height,
          orderIndex: ss.orderIndex,
        })),
      }
    }
  }

  // Determine default version: when editing, use the entry's version;
  // otherwise, use the latest (first in DESC order)
  let defaultVersionId = allVersions[0].id
  if (editEntry?.versionId) {
    defaultVersionId = editEntry.versionId
  }

  const gameVersionInfos: GameVersionInfo[] = allVersions

  // Fetch platform support for anti-cheat awareness
  const platformSupport = await db
    .select({
      hardwareSlug: gamePlatformSupport.hardwareSlug,
      antiCheatRelevant: gamePlatformSupport.antiCheatRelevant,
      antiCheatName: gamePlatformSupport.antiCheatName,
      antiCheatStatus: gamePlatformSupport.antiCheatStatus,
    })
    .from(gamePlatformSupport)
    .where(eq(gamePlatformSupport.gameId, game.id))

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
        gameVersions={gameVersionInfos}
        defaultVersionId={defaultVersionId}
        editEntry={editEntry}
        platformSupport={platformSupport}
      />
    </div>
  )
}

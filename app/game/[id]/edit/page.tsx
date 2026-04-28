import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { db } from "@/lib/db/index"
import { games, gamePlatformSupport, hardware } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { NonSteamEditForm } from "@/components/wizard/non-steam-edit-form"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Edit Game",
}

async function resolveGame(id: string) {
  const isNumeric = /^\d+$/.test(id)
  if (isNumeric) {
    const rows = await db.select().from(games).where(eq(games.steamAppId, Number(id))).limit(1)
    return rows[0]
  }
  const rows = await db.select().from(games).where(eq(games.id, id)).limit(1)
  return rows[0]
}

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session?.user) redirect("/login")

  const game = await resolveGame(id)
  if (!game) notFound()

  if (game.source === "steam") {
    notFound()
  }

  const platformSupport = await db
    .select()
    .from(gamePlatformSupport)
    .where(eq(gamePlatformSupport.gameId, game.id))

  const hardwareList = await db
    .select({ slug: hardware.slug, name: hardware.name, deviceType: hardware.deviceType })
    .from(hardware)
    .orderBy(hardware.sortOrder)

  const serializedGame = {
    id: game.id,
    title: game.title,
    developer: game.developer,
    publisher: game.publisher,
    description: game.description,
    source: game.source,
    storeUrl: game.storeUrl,
    headerImage: game.headerImage,
    capsuleImage: game.capsuleImage,
    genres: game.genres,
    releaseDate: game.releaseDate,
    createdBy: game.createdBy,
  }

  const serializedPlatformSupport = platformSupport.map(ps => ({
    hardwareSlug: ps.hardwareSlug,
    isSupported: ps.isSupported,
    protonStatus: ps.protonStatus,
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Edit Game</h1>
        <p className="text-sm text-text/60">
          Update details for <span className="text-text font-medium">{game.title}</span>
        </p>
      </div>
      <NonSteamEditForm
        game={serializedGame}
        platformSupport={serializedPlatformSupport}
        hardwareList={hardwareList}
        isOwner={session.user.id === game.createdBy}
        isAdmin={session.user.role === "admin"}
      />
    </div>
  )
}

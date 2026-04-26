import { notFound } from "next/navigation"
import { db } from "@/lib/db/index"
import { user, performanceEntries, games, gameVersions, hardware } from "@/lib/db/schema"
import { eq, sql, and, desc } from "drizzle-orm"
import { ProfilePageClient } from "./profile-page-client"

export const metadata = {
  title: "Profile",
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [profile] = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)

  if (!profile) {
    notFound()
  }

  // Count contributions
  const [{ count: contributions }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(performanceEntries)
    .where(and(
      eq(performanceEntries.userId, id),
      eq(performanceEntries.isRemoved, false)
    ))

  // Count verified entries
  const [{ count: verifiedEntries }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(performanceEntries)
    .where(and(
      eq(performanceEntries.userId, id),
      eq(performanceEntries.isRemoved, false),
      sql`${performanceEntries.verifiedAt} IS NOT NULL`
    ))

  // Fetch recent contributions (last 5)
  const recentContributions = await db
    .select({
      id: performanceEntries.id,
      fpsAvg: performanceEntries.fpsAvg,
      fpsLow: performanceEntries.fpsLow,
      fpsHigh: performanceEntries.fpsHigh,
      hardwareSlug: performanceEntries.hardwareSlug,
      hardwareName: hardware.name,
      upscalerType: performanceEntries.upscalerType,
      upscalerVersion: performanceEntries.upscalerVersion,
      frameGenMethod: performanceEntries.frameGenMethod,
      verifiedAt: performanceEntries.verifiedAt,
      createdAt: performanceEntries.createdAt,
      gameTitle: games.title,
      gameId: games.id,
      gameHeaderImage: games.headerImage,
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .innerJoin(games, eq(gameVersions.gameId, games.id))
    .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
    .where(and(
      eq(performanceEntries.userId, id),
      eq(performanceEntries.isRemoved, false)
    ))
    .orderBy(desc(performanceEntries.createdAt))
    .limit(5)

  return (
    <ProfilePageClient
      profile={{
        ...profile,
        createdAt: profile.createdAt.toISOString(),
        contributions,
        verifiedEntries,
        reputation: contributions * 10,
        verified: !!profile.emailVerified,
      }}
      recentContributions={recentContributions.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        verifiedAt: e.verifiedAt?.toISOString() ?? null,
      }))}
    />
  )
}

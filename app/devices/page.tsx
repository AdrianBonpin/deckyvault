import { db } from "@/lib/db/index"
import { hardware, performanceEntries, gameVersions, games } from "@/lib/db/schema"
import { eq, sql, desc } from "drizzle-orm"
import { DevicesPageClient } from "./page-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Devices — DeckyVault",
  description:
    "Browse benchmark data for handheld and console gaming devices. Compare FPS, performance stats, and community benchmarks on DeckyVault.",
  keywords: ["steam deck", "handheld", "console", "benchmarks", "FPS", "performance", "devices"],
  alternates: { canonical: "https://deckyvault.xyz/devices" },
  openGraph: {
    title: "Devices — DeckyVault",
    description:
      "Browse benchmark data for handheld and console gaming devices on DeckyVault.",
    url: "https://deckyvault.xyz/devices",
    siteName: "DeckyVault",
    type: "website",
  },
}

export default async function DevicesPage() {
  const deviceRows = await db
    .select({
      slug: hardware.slug,
      name: hardware.name,
      deviceType: hardware.deviceType,
      image: hardware.image,
      sortOrder: hardware.sortOrder,
    })
    .from(hardware)
    .orderBy(hardware.sortOrder)

  const statsPerDevice = await db
    .select({
      hardwareSlug: performanceEntries.hardwareSlug,
      totalBenchmarks: sql<number>`count(*)::int`,
      avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
      verifiedCount: sql<number>`count(*) filter (where ${performanceEntries.verifiedAt} is not null)::int`,
      gameCount: sql<number>`count(distinct ${gameVersions.gameId})::int`,
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .innerJoin(games, eq(gameVersions.gameId, games.id))
    .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
    .where(eq(performanceEntries.isRemoved, false))
    .groupBy(performanceEntries.hardwareSlug)

  const statsMap = new Map(statsPerDevice.map((s) => [s.hardwareSlug, s]))

  const bestGames = await db
    .select({
      hardwareSlug: performanceEntries.hardwareSlug,
      gameId: games.id,
      gameTitle: games.title,
      gameHeaderImage: games.headerImage,
      fpsAvg: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .innerJoin(games, eq(gameVersions.gameId, games.id))
    .where(eq(performanceEntries.isRemoved, false))
    .groupBy(
      performanceEntries.hardwareSlug,
      games.id,
      games.title,
      games.headerImage,
    )
    .orderBy(desc(sql`avg(${performanceEntries.fpsAvg})`))

  const bestGameMap = new Map<
    string,
    { id: string; title: string; headerImage: string | null; fpsAvg: number }
  >()
  for (const bg of bestGames) {
    if (!bestGameMap.has(bg.hardwareSlug)) {
      bestGameMap.set(bg.hardwareSlug, {
        id: bg.gameId,
        title: bg.gameTitle,
        headerImage: bg.gameHeaderImage,
        fpsAvg: Number(bg.fpsAvg),
      })
    }
  }

  const devices = deviceRows.map((device, index) => {
    const stats = statsMap.get(device.slug)
    const bestGame = bestGameMap.get(device.slug)
    return {
      slug: device.slug,
      name: device.name,
      deviceType: device.deviceType,
      image: device.image,
      sortOrder: device.sortOrder,
      colorIndex: index,
      totalBenchmarks: stats?.totalBenchmarks ?? 0,
      avgFps: stats?.avgFps ? Number(stats.avgFps) : null,
      gameCount: stats?.gameCount ?? 0,
      verifiedCount: stats?.verifiedCount ?? 0,
      bestGame: bestGame ?? null,
    }
  })

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: devices.map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: d.name,
      url: `https://deckyvault.xyz/devices/${d.slug}`,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DevicesPageClient devices={devices} />
    </>
  )
}

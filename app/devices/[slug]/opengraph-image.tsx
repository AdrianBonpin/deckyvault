import { ImageResponse } from "next/og"
import { db } from "@/lib/db/index"
import { hardware, performanceEntries, gameVersions, games } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"

export const runtime = "nodejs"
export const alt = "Device benchmarks on DeckyVault"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const [device] = await db
    .select({
      name: hardware.name,
      deviceType: hardware.deviceType,
    })
    .from(hardware)
    .where(eq(hardware.slug, slug))
    .limit(1)

  if (!device) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#100b14",
            color: "#ebe4f1",
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700 }}>DeckyVault</div>
          <div style={{ fontSize: 20, color: "#6b5a7d", marginTop: 8 }}>
            Device Not Found
          </div>
        </div>
      ),
      { ...size }
    )
  }

  const [stats] = await db
    .select({
      totalBenchmarks: sql<number>`count(*)::int`,
      avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
      gameCount: sql<number>`count(distinct ${gameVersions.gameId})::int`,
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .innerJoin(games, eq(gameVersions.gameId, games.id))
    .where(
      and(
        eq(performanceEntries.hardwareSlug, slug),
        eq(performanceEntries.isRemoved, false)
      )
    )

  const typeLabel = device.deviceType === "handheld" ? "Handheld" : "Console"
  const avgFpsStr = stats?.avgFps ? String(Math.round(Number(stats.avgFps))) : "—"

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          backgroundColor: "#100b14",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              color: "#eb3779",
              backgroundColor: "#eb377920",
              border: "1px solid #eb377940",
            }}
          >
            {typeLabel}
          </div>
        </div>
        <div style={{ fontSize: 56, fontWeight: 700, color: "#ebe4f1", lineHeight: 1.1, marginBottom: 24 }}>
          {device.name}
        </div>
        <div style={{ display: "flex", gap: 32, fontSize: 18, color: "#6b5a7d" }}>
          <div>
            <span style={{ color: "#ebe4f1", fontWeight: 600, fontSize: 24 }}>{stats?.totalBenchmarks ?? 0}</span> Benchmarks
          </div>
          <div>
            <span style={{ color: "#22c55e", fontWeight: 600, fontSize: 24 }}>{avgFpsStr}</span> Avg FPS
          </div>
          <div>
            <span style={{ color: "#ebe4f1", fontWeight: 600, fontSize: 24 }}>{stats?.gameCount ?? 0}</span> Games
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 40, left: 80, fontSize: 16, color: "#4a3a5c", fontWeight: 500 }}>
          deckyvault.xyz
        </div>
      </div>
    ),
    { ...size }
  )
}

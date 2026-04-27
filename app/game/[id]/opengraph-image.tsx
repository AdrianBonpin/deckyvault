import { ImageResponse } from "next/og"
import { db } from "@/lib/db/index"
import { games, gameVersions, performanceEntries } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "DeckyVault - Game Benchmarks"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const isNumeric = /^\d+$/.test(id)

    let game
    if (isNumeric) {
        const rows = await db.select().from(games).where(eq(games.steamAppId, Number(id))).limit(1)
        game = rows[0]
    } else {
        const rows = await db.select().from(games).where(eq(games.id, id)).limit(1)
        game = rows[0]
    }

    if (!game) {
        return new ImageResponse(
            (
                <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#100b14", color: "#ebe4f1", fontFamily: "sans-serif", gap: "16px" }}>
                    <div style={{ fontSize: 48, fontWeight: 700 }}>Game Not Found</div>
                    <div style={{ fontSize: 24, opacity: 0.7 }}>DeckyVault</div>
                </div>
            ),
            { ...size }
        )
    }

    // Get best FPS stat
    let avgFps: number | null = null
    try {
        const [bestStat] = await db
            .select({ avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)` })
            .from(performanceEntries)
            .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
            .where(and(eq(gameVersions.gameId, game.id), eq(performanceEntries.isRemoved, false)))
            .limit(1)
        avgFps = bestStat?.avgFps ?? null
    } catch {
        // No FPS data available — that's fine
    }

    const logoData = await readFile(join(process.cwd(), "app/icon.png"), "base64")
    const logoSrc = `data:image/png;base64,${logoData}`

    return new ImageResponse(
        (
            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px", background: "#100b14", color: "#ebe4f1", fontFamily: "sans-serif" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
                    <img src={logoSrc} alt="" height={48} style={{ borderRadius: "8px" }} />
                    <span style={{ fontSize: 24, fontWeight: 600, opacity: 0.8 }}>DeckyVault</span>
                </div>
                <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1, marginBottom: "16px", maxWidth: "900px" }}>
                    {game.title}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "24px", fontSize: 24, opacity: 0.8 }}>
                    {game.developer && <span>by {game.developer}</span>}
                    {avgFps !== null && <span style={{ color: "#22c55e" }}>~{avgFps} avg FPS</span>}
                </div>
                {game.genres && game.genres.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                        {game.genres.slice(0, 4).map((genre: string) => (
                            <span key={genre} style={{ padding: "4px 12px", borderRadius: "9999px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)", fontSize: 16 }}>
                                {genre}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        ),
        { ...size }
    )
}

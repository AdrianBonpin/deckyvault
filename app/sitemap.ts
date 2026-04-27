import type { MetadataRoute } from "next"
import { db } from "@/lib/db/index"
import { games, hardware } from "@/lib/db/schema"

const BASE_URL = "https://deckyvault.xyz"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [allGames, allDevices] = await Promise.all([
        db.select({ id: games.id, updatedAt: games.updatedAt }).from(games),
        db.select({ slug: hardware.slug, createdAt: hardware.createdAt }).from(hardware),
    ])

    const gameEntries: MetadataRoute.Sitemap = allGames.map((game) => ({
        url: `${BASE_URL}/game/${game.id}`,
        lastModified: game.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
    }))

    const deviceEntries: MetadataRoute.Sitemap = allDevices.map((device) => ({
        url: `${BASE_URL}/devices/${device.slug}`,
        lastModified: device.createdAt,
        changeFrequency: "monthly",
        priority: 0.6,
    }))

    return [
        { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
        { url: `${BASE_URL}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
        { url: `${BASE_URL}/devices`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
        ...gameEntries,
        ...deviceEntries,
    ]
}

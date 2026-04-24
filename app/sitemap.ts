import type { MetadataRoute } from "next"

const BASE_URL = "https://deckyvault.xyz"

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: BASE_URL,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
        // Future dynamic routes can be added here:
        // {
        //     url: `${BASE_URL}/games/${game.slug}`,
        //     lastModified: game.updatedAt,
        //     changeFrequency: "weekly",
        //     priority: 0.8,
        // },
    ]
}

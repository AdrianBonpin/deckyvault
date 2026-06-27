import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/manage", "/api"],
            },
        ],
        sitemap: "https://deckyvault.xyz/sitemap.xml",
    }
}
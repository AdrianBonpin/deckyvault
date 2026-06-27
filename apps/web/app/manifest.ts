import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "DeckyVault - Steam Deck Benchmarks & Settings",
        short_name: "DeckyVault",
        description:
            "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
        start_url: "/",
        display: "standalone",
        background_color: "#100b14",
        theme_color: "#eb3779",
        icons: [
            {
                src: "/icon-192.png",
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: "/icon-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any",
            },
            {
                src: "/icon.png",
                sizes: "any",
                type: "image/png",
            },
        ],
    }
}

import type { Metadata } from "next"
import { buildBreadcrumbList } from "@/lib/utils/seo"
import { PluginPageClient } from "./page-client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
    title: "DeckyVault Plugin — Record & Upload Steam Deck Benchmarks",
    description:
        "Install the DeckyVault Decky Loader plugin to capture FPS, frame times, and power draw with MangoHud, then upload performance entries straight to DeckyVault from your Steam Deck.",
    keywords: [
        "decky loader plugin",
        "steam deck plugin",
        "mangohud",
        "steam deck benchmark",
        "performance logging",
        "deckyvault",
    ],
    alternates: { canonical: "https://deckyvault.xyz/plugin" },
    openGraph: {
        title: "DeckyVault Plugin — Record & Upload Steam Deck Benchmarks",
        description:
            "Capture FPS and power draw with MangoHud, then upload to DeckyVault straight from your Steam Deck.",
        url: "https://deckyvault.xyz/plugin",
        siteName: "DeckyVault",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "DeckyVault Plugin",
        description:
            "Record Steam Deck performance and upload to DeckyVault with the Decky Loader plugin.",
    },
}

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DeckyVault Plugin",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "SteamOS",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description:
        "A Decky Loader plugin that records Steam Deck performance metrics with MangoHud and uploads them to DeckyVault.",
    url: "https://deckyvault.xyz/plugin",
}

const breadcrumbs = buildBreadcrumbList([
    { name: "Home", url: "https://deckyvault.xyz/" },
    { name: "Plugin", url: "https://deckyvault.xyz/plugin" },
])

export default function PluginPage() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
            />
            <PluginPageClient />
        </>
    )
}
import type { Metadata } from "next"
import { buildBreadcrumbList } from "@/lib/utils/seo"
import { PluginPageClient } from "./page-client"

export const dynamic = "force-dynamic"

const CANONICAL = "https://deckyvault.xyz/plugin"
const TITLE = "DeckyVault Plugin — Record & Upload Steam Deck Benchmarks"
const DESCRIPTION =
    "Install the DeckyVault Decky Loader plugin to capture FPS, frame times, and power draw with MangoHud, then upload performance entries straight to DeckyVault from your Steam Deck. Free, open source, controller-friendly."

export const metadata: Metadata = {
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
        "decky loader plugin",
        "deckyvault plugin",
        "steam deck plugin",
        "steam deck benchmark tool",
        "mangohud",
        "mangohud steam deck",
        "steam deck performance logging",
        "steam deck fps recorder",
        "steam deck benchmark",
        "performance logging",
        "deckyvault",
        "steam deck tdp",
        "steam deck frame times",
        "decky plugin install",
    ],
    alternates: { canonical: CANONICAL },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
        },
    },
    openGraph: {
        title: TITLE,
        description:
            "Capture FPS and power draw with MangoHud, then upload to DeckyVault straight from your Steam Deck. QR-code pairing, one-tap upload, auto game detection.",
        url: CANONICAL,
        siteName: "DeckyVault",
        type: "website",
        locale: "en_US",
        images: [
            {
                url: "/opengraph-image",
                width: 1200,
                height: 630,
                alt: "DeckyVault Plugin for Steam Deck",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "DeckyVault Plugin — Steam Deck Benchmark Recorder",
        description:
            "Record Steam Deck performance with MangoHud and upload to DeckyVault with the Decky Loader plugin. QR pairing, one-tap upload.",
        images: ["/opengraph-image"],
    },
    category: "technology",
    authors: [{ name: "DeckyVault", url: "https://deckyvault.xyz" }],
    creator: "DeckyVault",
    publisher: "DeckyVault",
}

// ── Structured data ────────────────────────────────────────────────
// SoftwareApplication describes the plugin itself; FAQPage captures the
// install/setup steps so search engines can surface rich results.

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "DeckyVault Plugin",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "SteamOS",
    softwareVersion: "1.1.0",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description:
        "A Decky Loader plugin that records Steam Deck performance metrics (FPS, frame times, power draw) with MangoHud and uploads them to DeckyVault.",
    url: CANONICAL,
    downloadUrl:
        "https://github.com/AdrianBonpin/deckyvault/releases",
    author: {
        "@type": "Organization",
        name: "DeckyVault",
        url: "https://deckyvault.xyz",
    },
    featureList: [
        "Capture FPS, frame times, and 1% lows with MangoHud",
        "Measure CPU + GPU power draw with peripheral overhead",
        "QR-code pairing with your DeckyVault account",
        "One-tap upload of performance entries",
        "Automatic game and Proton version detection",
        "Controller-friendly Quick Access Menu UI",
    ],
    screenshot: "https://deckyvault.xyz/plugin/panel-overview.jpg",
}

const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
        {
            "@type": "Question",
            name: "How do I install the DeckyVault plugin?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Install Decky Loader on your Steam Deck, then either use 'Install Plugin from ZIP File' with the downloaded plugin ZIP, or 'Install Plugin from URL' with the direct download link from the GitHub release.",
            },
        },
        {
            "@type": "Question",
            name: "Do I need to manually copy an API key?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "No. Open the plugin in the Quick Access Menu, tap 'Pair with Phone', and scan the QR code with your phone. Confirm on deckyvault.xyz and your account links automatically — the API key is created and saved for you.",
            },
        },
        {
            "@type": "Question",
            name: "What does the plugin record?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "It captures FPS averages, frame times, 1% lows, and total power draw (CPU + GPU plus peripheral overhead) using MangoHud, along with the detected game, Steam App ID, and Proton version.",
            },
        },
        {
            "@type": "Question",
            name: "Is the DeckyVault plugin free?",
            acceptedAnswer: {
                "@type": "Answer",
                text: "Yes, the plugin is free and open source.",
            },
        },
    ],
}

const breadcrumbs = buildBreadcrumbList([
    { name: "Home", url: "https://deckyvault.xyz/" },
    { name: "Plugin", url: CANONICAL },
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
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
            />
            <PluginPageClient />
        </>
    )
}
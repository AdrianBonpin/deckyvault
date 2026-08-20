import type { Metadata, Viewport } from "next"
import { Lexend } from "next/font/google"
import "./globals.css"
import Script from "next/script"
import Navbar from "@/components/navbar"
import { Suspense } from "react"

const font = Lexend({
    variable: "--font-lexend",
    subsets: ["latin"],
})

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: "#eb3779",
}

export const metadata: Metadata = {
    metadataBase: new URL("https://deckyvault.xyz"),
    title: {
        default: "DeckyVault - Steam Deck Benchmarks & Settings",
        template: "%s | DeckyVault",
    },
    description:
        "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
    keywords: [
        "Steam Deck",
        "benchmarks",
        "settings",
        "performance",
        "FPS",
        "gaming",
        "Steam Machine",
        "Proton",
        "FSR",
        "compatibility",
    ],
    authors: [
        { name: "Adrian Bonpin", url: "https://git.ranio.xyz/adrianbonpin" },
    ],
    creator: "@adrianbonpin",
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://deckyvault.xyz",
        siteName: "DeckyVault",
        title: "DeckyVault - Steam Deck Benchmarks & Settings",
        description:
            "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
        images: [
            {
                url: "/opengraph-image",
                width: 1200,
                height: 630,
                alt: "DeckyVault - Steam Deck Benchmarks & Settings",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "DeckyVault - Steam Deck Benchmarks & Settings",
        description:
            "A fast, modern browser for finding game benchmarks, settings, and guides for Steam Deck OLED, Steam Deck LCD, and Steam Machine.",
        creator: "@adrianbonpin",
        images: ["/twitter-image"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
    alternates: {
        canonical: "https://deckyvault.xyz",
    },
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang='en'
            className={`${font.variable} bg-background text-text antialiased overscroll-none scroll-smooth`}
        >
            <head>
                {/* DNS prefetch + preconnect for external image CDNs */}
                <link rel="dns-prefetch" href="https://cdn.akamai.steamstatic.com" />
                <link rel="preconnect" href="https://cdn.akamai.steamstatic.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://cdn.steamgriddb.com" />
                <link rel="preconnect" href="https://cdn.steamgriddb.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://cdn2.steamgriddb.com" />
                <link rel="preconnect" href="https://cdn2.steamgriddb.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://cdn.deckyvault.xyz" />
                <link rel="preconnect" href="https://cdn.deckyvault.xyz" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
                <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://cdn.discordapp.com" />
                <link rel="preconnect" href="https://cdn.discordapp.com" crossOrigin="anonymous" />
                {/* PWA meta */}
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            </head>
            <body className='min-h-full w-dvw flex flex-col relative'>
                <Suspense>
                    <Navbar />
                </Suspense>
                {children}
                <Script
                    src='https://stat.ranio.xyz/api/script.js'
                    data-site-id='b9817e8df599'
                    strategy='afterInteractive'
                />
            </body>
        </html>
    )
}


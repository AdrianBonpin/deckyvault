import type { Metadata } from "next"
import { Lexend } from "next/font/google"
import "./globals.css"
import Script from "next/script"
import Navbar from "@/components/navbar"
import { Suspense } from "react"

const font = Lexend({
    variable: "--font-lexend",
    subsets: ["latin"],
})

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
        { name: "Adrian Bonpin", url: "https://github.com/AdrianBonpin" },
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
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang='en'
            className={`${font.variable} bg-background text-text antialiased overscroll-none`}
        >
            <body className='min-h-full w-dvw flex flex-col relative'>
                <Suspense>
                    <Navbar />
                </Suspense>
                {children}
                <Script
                    src='https://analytics.ranlabs.space/api/script.js'
                    data-site-id='b9817e8df599'
                    strategy='afterInteractive'
                />
            </body>
        </html>
    )
}

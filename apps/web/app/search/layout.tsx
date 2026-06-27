import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Search Games",
    description: "Search for games and find benchmarks, settings, and performance data on DeckyVault.",
    alternates: { canonical: "https://deckyvault.xyz/search" },
    robots: { index: false },
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
    return children
}

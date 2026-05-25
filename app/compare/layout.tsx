import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Compare Games",
    description:
        "Compare Steam Deck game benchmarks side by side. See FPS, settings, and performance data across multiple titles on DeckyVault.",
    alternates: { canonical: "https://deckyvault.xyz/compare" },
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
    return children
}
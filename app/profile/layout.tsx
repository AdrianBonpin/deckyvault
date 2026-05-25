import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Profile",
    description:
        "Your DeckyVault profile — saved games, benchmark contributions, and performance history.",
    robots: { index: false, follow: false },
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
    return children
}
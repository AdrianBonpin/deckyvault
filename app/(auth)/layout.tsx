import type { Metadata } from "next"
import { Lock } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
    title: "Authentication",
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex-1 flex items-center justify-center px-4 py-8 relative overflow-hidden">
            {/* Background decorative orbs */}
            <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-[#eb3779]/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-16 right-16 w-24 h-24 rounded-full bg-[#571b8b]/15 blur-2xl pointer-events-none" />

            {/* Auth card */}
            <div className="w-full max-w-[400px] bg-white/[0.03] border border-white/[0.08] rounded-xl p-7 backdrop-blur-sm relative z-10">
                {/* Logo */}
                <Link
                    href="/"
                    className="flex items-center justify-center gap-2 mb-6"
                >
                    <Lock className="h-5 w-5 text-[#eb3779]" />
                    <span className="text-lg font-bold text-[#ebe4f1]">
                        DeckyVault
                    </span>
                </Link>

                {children}
            </div>
        </div>
    )
}

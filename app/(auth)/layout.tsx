import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import logo from "@/app/icon.png"

export const metadata: Metadata = {
    title: "Authentication",
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-[calc(100vh-3.6rem)] flex items-center justify-center px-4 relative overflow-hidden">
            {/* Background decorative orbs */}
            <div className="absolute top-20 left-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-20 right-10 w-36 h-36 rounded-full bg-secondary/15 blur-2xl pointer-events-none" />

            {/* Auth card */}
            <div className="w-full max-w-md bg-text/5 border border-border rounded-xl p-8 relative z-10">
                {/* Logo */}
                <Link
                    href="/"
                    className="flex flex-col items-center gap-2 mb-8"
                >
                    <Image
                        src={logo}
                        alt="DeckyVault Logo"
                        className="h-10 w-auto"
                    />
                    <span className="text-lg font-bold text-text">
                        DeckyVault
                    </span>
                </Link>

                {children}
            </div>
        </div>
    )
}

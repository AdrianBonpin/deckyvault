"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import {
    UsersIcon,
    CpuIcon,
    Gamepad2Icon,
    HardDriveIcon,
    MessageSquareIcon,
    MessageSquarePlusIcon,
    FlagIcon,
    BarChart3Icon,
    LayoutDashboardIcon,
} from "lucide-react"

type NavItem =
    | { type: "section"; label: string }
    | { type: "divider" }
    | { type: "link"; href: string; label: string; icon: React.ElementType; adminOnly?: boolean }

const navItems: NavItem[] = [
    { type: "section", label: "Overview" },
    {
        type: "link",
        href: "/manage",
        label: "Dashboard",
        icon: LayoutDashboardIcon,
    },
    {
        type: "link",
        href: "/manage/analytics",
        label: "Analytics",
        icon: BarChart3Icon,
    },
    { type: "divider" },
    { type: "section", label: "Management" },
    { type: "link", href: "/manage/users", label: "Users", icon: UsersIcon, adminOnly: true },
    {
        type: "link",
        href: "/manage/hardware",
        label: "Hardware",
        icon: CpuIcon,
    },
    {
        type: "link",
        href: "/manage/storage",
        label: "Storage",
        icon: HardDriveIcon,
        adminOnly: true,
    },
    { type: "link", href: "/manage/games", label: "Games", icon: Gamepad2Icon },
    { type: "divider" },
    { type: "section", label: "Moderation" },
    { type: "link", href: "/manage/reports", label: "Reports", icon: FlagIcon },
    {
        type: "link",
        href: "/manage/suggestions",
        label: "Suggestions",
        icon: MessageSquarePlusIcon,
    },
    {
        type: "link",
        href: "/manage/benchmarks",
        label: "Benchmarks",
        icon: BarChart3Icon,
    },
    {
        type: "link",
        href: "/manage/comments",
        label: "Comments",
        icon: MessageSquareIcon,
    },
]

export function ManageSidebar() {
    const pathname = usePathname()
    const { data: session } = useSession()
    const role = session?.user?.role ?? "user"
    const isAdmin = role === "admin"

    return (
        <nav className='md:w-56 shrink-0'>
            <div className='hidden md:flex items-center gap-2 px-3 py-2 mb-2 text-sm font-semibold text-text/70'>
                <LayoutDashboardIcon className='h-4 w-4' />
                Manage Panel
            </div>

            <div className='flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:border-r md:border-border md:pr-3'>
                {navItems.map((item, index) => {
                    // Hide admin-only items for non-admins
                    if (item.type === "link" && item.adminOnly && !isAdmin) return null

                    if (item.type === "section") {
                        return (
                            <div
                                key={`section-${item.label}`}
                                className='hidden md:block px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-text/30'
                            >
                                {item.label}
                            </div>
                        )
                    }

                    if (item.type === "divider") {
                        return [
                            <div
                                key={`div-m-${index}`}
                                className='w-px bg-border shrink-0 self-stretch md:hidden'
                            />,
                            <div
                                key={`div-d-${index}`}
                                className='hidden md:block h-px bg-border'
                            />,
                        ]
                    }

                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 px-4 md:px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-lg ${
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-text/50 hover:text-text/70 hover:bg-text/5"
                            }`}
                        >
                            <item.icon className='h-4 w-4 shrink-0' />
                            {item.label}
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}

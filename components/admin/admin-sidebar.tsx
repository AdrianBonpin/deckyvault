"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { UsersIcon, CpuIcon, Gamepad2Icon, MessageSquareIcon } from "lucide-react"

const adminNavItems = [
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/hardware", label: "Hardware", icon: CpuIcon },
  { href: "/admin/games", label: "Games", icon: Gamepad2Icon },
  { href: "/admin/comments", label: "Comments", icon: MessageSquareIcon },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <nav className="md:w-48 shrink-0">
      <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:border-r md:border-border">
        {adminNavItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap rounded-lg md:rounded-none md:border-l-2 md:border-r-0 md:border-transparent ${
                isActive
                  ? "bg-primary/10 text-primary md:border-l-primary"
                  : "text-text/50 hover:text-text/70 hover:bg-text/5"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

"use client"

import { AnimatePresence, motion } from "motion/react"
import logo from "@/app/icon.png"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { CircleXIcon, Gamepad2Icon, MenuIcon, XIcon } from "lucide-react"
import { routes } from "@/lib/routes"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/lib/hooks/useDebounce"

export default function Navbar() {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const isLanding = pathname === "/"

    const [searchQuery, setSearchQuery] = useState("")
    const debouncedQuery = useDebounce(searchQuery, 300)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isFocused, setIsFocused] = useState(false)
    const [forceFocusStyles, setForceFocusStyles] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Sync search query with URL ?q= param
    useEffect(() => {
        const q = searchParams.get("q") || ""
        setSearchQuery(q)
    }, [searchParams])

    // Update URL when debounced query changes (skip if already matches)
    useEffect(() => {
        if (isLanding) return
        const currentQ = searchParams.get("q") || ""
        if (debouncedQuery === currentQ) return

        const params = new URLSearchParams(searchParams.toString())
        if (debouncedQuery) {
            params.set("q", debouncedQuery)
        } else {
            params.delete("q")
        }
        router.replace(`/search?${params.toString()}`, { scroll: false })
    }, [debouncedQuery, isLanding, router, searchParams])

    // Maintain focus & styles when flying from landing page search
    useEffect(() => {
        if (
            !isLanding &&
            searchQuery &&
            sessionStorage.getItem("focusSearch") === "true"
        ) {
            sessionStorage.removeItem("focusSearch")
            setForceFocusStyles(true)
            // Focus the input after the layout animation element mounts
            requestAnimationFrame(() => {
                inputRef.current?.focus()
            })
            const timer = setTimeout(() => setForceFocusStyles(false), 450)
            return () => clearTimeout(timer)
        }
    }, [isLanding, searchQuery])

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value)
    }

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearchSubmit()
        }
    }

    const navbarRoutes = routes.filter(
        (route) => route.href !== "/" && route.href !== "/search",
    )

    return (
        <>
            <motion.nav
                initial={{ opacity: 0, y: "-100%" }}
                animate={{ opacity: 1, y: 0 }}
                className='w-full flex flex-row px-4 md:px-[10svw] py-2 items-center gap-4 md:gap-8 justify-between border-b border-border sticky top-0 z-50 backdrop-blur-sm bg-background/80'
            >
                <Link
                    href='/'
                    className='flex flex-row gap-2 items-center font-bold text-lg py-1 shrink-0'
                >
                    <Image
                        src={logo}
                        alt='DeckyVault Logo'
                        className='h-6 my-1 w-auto'
                    />
                    {!isLanding && (
                        <motion.span className='hidden md:inline-block'>
                            DeckyVault
                        </motion.span>
                    )}
                </Link>

                <AnimatePresence>
                    {!isLanding && (
                        <motion.label
                            key='search-bar'
                            layoutId='search-bar'
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.3 }}
                            className={`flex flex-row items-center gap-2 flex-1 bg-text/5 px-2 py-1 rounded-md border placeholder:text-text/60 group transition-colors cursor-text ${
                                isFocused || forceFocusStyles
                                    ? "border-primary/80 ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
                                    : "border-border hover:border-border-active"
                            }`}
                        >
                            <Gamepad2Icon
                                className={`h-4 w-4 transition-colors shrink-0 ${
                                    isFocused || forceFocusStyles
                                        ? "stroke-accent"
                                        : ""
                                }`}
                            />
                            <input
                                ref={inputRef}
                                type='text'
                                placeholder='search by game or appid...'
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                className='flex-1 outline-none bg-transparent text-sm min-w-0'
                            />
                            <motion.button>
                                <CircleXIcon
                                    onClick={() => {
                                        setSearchQuery("")
                                        if (!isLanding) {
                                            const params = new URLSearchParams(
                                                searchParams.toString(),
                                            )
                                            params.delete("q")
                                            router.replace(
                                                `/search?${params.toString()}`,
                                                {
                                                    scroll: false,
                                                },
                                            )
                                        }
                                    }}
                                    className={`h-3 w-3 transition-color cursor-default hover:stroke-accent transition-all ${
                                        isFocused || forceFocusStyles
                                            ? "opacity-100"
                                            : "opacity-0"
                                    }`}
                                />
                            </motion.button>
                        </motion.label>
                    )}
                </AnimatePresence>

                {/* Desktop Navigation Links */}
                <ul className='hidden md:flex flex-row items-center gap-6 shrink-0'>
                    {navbarRoutes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            title={`Navigate to ${route.title}`}
                            className='text-sm font-medium hover:text-primary transition-colors uppercase'
                        >
                            {route.title}
                        </Link>
                    ))}
                </ul>

                {/* Mobile Hamburger Button */}
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className='flex md:hidden flex-row items-center justify-center p-2 -mr-2 rounded-md hover:bg-text/5 transition-colors'
                    aria-label='Open menu'
                >
                    <MenuIcon className='h-5 w-5' />
                </button>
            </motion.nav>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className='fixed inset-0 bg-black/50 z-60 md:hidden'
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.aside
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{
                                type: "spring",
                                damping: 25,
                                stiffness: 250,
                            }}
                            className='fixed top-0 right-0 bottom-0 w-64 bg-background border-l border-border z-70 md:hidden flex flex-col'
                        >
                            <div className='flex flex-row items-center justify-between px-4 py-2 border-b border-border'>
                                <span className='font-bold text-lg'>Menu</span>
                                <button
                                    onClick={() => setMobileMenuOpen(false)}
                                    className='p-2 -mr-2 rounded-md hover:bg-text/5 transition-colors'
                                    aria-label='Close menu'
                                >
                                    <XIcon className='h-5 w-5' />
                                </button>
                            </div>
                            <nav className='flex flex-col p-4 gap-2'>
                                {routes.map((route) => (
                                    <Link
                                        key={route.href}
                                        href={route.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`text-sm font-medium hover:text-primary transition-colors uppercase px-3 py-2 rounded-md hover:bg-text/5 ${
                                            pathname === route.href
                                                ? "text-primary bg-text/5"
                                                : ""
                                        }`}
                                    >
                                        {route.title}
                                    </Link>
                                ))}
                            </nav>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

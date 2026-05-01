"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import Link from "next/link"
import { Gamepad2Icon, SearchIcon } from "lucide-react"
import { useRouter } from "next/navigation"

export default function Landing() {
    const router = useRouter()
    const words = ["benchmarks", "settings", "reviews"]

    const [currentWord, setCurrentWord] = useState(0)

    setTimeout(() => {
        setCurrentWord((currentWord + 1) % words.length)
    }, 2000)

    const [searchQuery, setSearchQuery] = useState("")

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            sessionStorage.setItem("focusSearch", "true")
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearchSubmit()
        }
    }

    return (
        <section
            id='hero'
            className='w-full h-[calc(100vh-3.6rem)] flex flex-col items-center justify-center relative p-4'
        >
            <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='font-bold text-3xl md:text-5xl text-center flex flex-row gap-2 items-center justify-center'
            >
                DeckyVault
                <span className='border border-border text-xs md:text-base px-2 py-1 rounded-md bg-primary/10 font-medium'>
                    beta
                </span>
            </motion.h1>
            <motion.h2
                layout
                initial={{
                    opacity: 0,
                }}
                animate={{ opacity: 0.8, transition: { delay: 0.5 } }}
                className='mt-4 flex flex-row flex-wrap items-center justify-center gap-x-1 md:gap-x-2 text-base md:text-xl'
            >
                {"Find your game".split(" ").map((word, index) => (
                    <motion.span
                        key={index}
                        className='text-center'
                    >
                        {word}
                    </motion.span>
                ))}
                <AnimatePresence
                    mode='wait'
                    initial={false}
                >
                    <motion.span
                        key={currentWord}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className='text-primary font-bold'
                    >
                        {words[currentWord]}
                    </motion.span>
                </AnimatePresence>
            </motion.h2>
            <AnimatePresence>
                <motion.label
                    key='search-bar'
                    layoutId='search-bar'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className='mt-8 flex flex-row items-center gap-4 bg-text/5 px-2 py-2 rounded-md border border-border placeholder:text-text/60 group hover:border-border-active transition-colors focus-within:border-primary/80! focus-within:ring-2 focus-within:ring-primary/50! focus-within:ring-offset-2 focus-within:ring-offset-background cursor-text w-full max-w-md'
                >
                    <Gamepad2Icon className='h-6 w-6 group-focus-within:stroke-accent transition-colors shrink-0' />
                    <input
                        type='text'
                        placeholder='search by game or appid...'
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className='flex-1 outline-none bg-transparent text-xl min-w-0'
                    />
                    <motion.button
                        onClick={handleSearchSubmit}
                        whileTap={{ scale: 0.95 }}
                        className='text-sm flex flex-row gap-1 items-center bg-text text-background px-2 py-1 rounded-sm cursor-pointer hover:opacity-60 transition-opacity shrink-0'
                    >
                        <SearchIcon className='h-3 w-3' />
                        search
                    </motion.button>
                </motion.label>
            </AnimatePresence>
            <motion.small
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 1.5 } }}
                className='mt-8 text-center text-xs flex flex-row gap-1'
            >
                <Link
                    title='Visit our Github Repository'
                    href='/updates'
                    className='text-accent opacity-60 hover:opacity-100 transition-opacity cursor-pointer'
                >
                    See what{"'"}s new.
                </Link>
            </motion.small>
            <motion.small
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 1.5 } }}
                className='mt-2 text-center text-xs flex flex-row gap-1'
            >
                <span className='opacity-60'>2026 DeckyVault.</span>
                <Link
                    title='Visit our Github Repository'
                    href='https://github.com/AdrianBonpin/deckyvault'
                    className='text-accent opacity-60 hover:opacity-100 transition-opacity cursor-pointer'
                >
                    Github.
                </Link>
                <span className="opacity-60">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            </motion.small>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "WebSite",
                        name: "DeckyVault",
                        url: "https://deckyvault.xyz",
                        description:
                            "Steam Deck benchmarks, settings, and performance guides",
                        potentialAction: {
                            "@type": "SearchAction",
                            target: "https://deckyvault.xyz/search?q={search_term_string}",
                            "query-input": "required name=search_term_string",
                        },
                    }),
                }}
            />
        </section>
    )
}

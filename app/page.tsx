"use client"

import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import logo from "@/app/icon.png"
import Image from "next/image"
import Link from "next/link"

export default function Landing() {
    const words = ["benchmarks", "settings", "guides", "reviews"]

    const [currentWord, setCurrentWord] = useState(0)

    setTimeout(() => {
        setCurrentWord((currentWord + 1) % words.length)
    }, 2000)

    return (
        <section
            id='hero'
            className='w-dvw h-dvh flex flex-col items-center justify-center relative p-4'
        >
            <Image
                src={logo}
                alt=''
                className='h-24 md:h-30 w-auto'
                loading='eager'
            />
            <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='font-bold text-3xl md:text-5xl text-center'
            >
                DeckyVault
            </motion.h1>
            <motion.h2
                initial={{
                    opacity: 0,
                }}
                animate={{ opacity: 1, transition: { delay: 0.5 } }}
                className='mt-4 flex flex-col items-center font-semibold text-lg md:text-2xl'
            >
                <motion.span
                    key='intro'
                    className='text-center'
                >
                    A fast, modern browser for finding game
                </motion.span>
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
            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6, transition: { delay: 1 } }}
                className='mt-4 text-center md:text-lg max-w-xl'
            >
                Stay tuned for the launch of DeckyVault
            </motion.p>
            <motion.small
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 1.5 } }}
                className='absolute bottom-4 text-center text-xs flex flex-row gap-1'
            >
                <span className='opacity-60'>2026 DeckyVault.</span>
                <Link
                    title='Visit our Github Repository'
                    href='https://github.com/AdrianBonpin/deckyvault'
                    className='text-accent opacity-60 hover:opacity-100 transition-opacity'
                >
                    Github.
                </Link>
            </motion.small>
        </section>
    )
}

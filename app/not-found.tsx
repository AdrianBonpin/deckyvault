"use client"

import { motion } from "motion/react"
import Link from "next/link"

export default function NotFound() {
  return (
    <section className="w-dvw h-dvh flex flex-col items-center justify-center relative p-4">
      <motion.h1
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="font-bold text-8xl md:text-9xl text-primary"
      >
        404
      </motion.h1>
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.3 } }}
        className="mt-4 font-semibold text-xl md:text-2xl text-center"
      >
        This page doesn&apos;t exist yet
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6, transition: { delay: 0.6 } }}
        className="mt-2 text-center max-w-md"
      >
        The page you&apos;re looking for hasn&apos;t been built yet, or may have
        been moved.
      </motion.p>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: 0.9 } }}
        className="mt-8"
      >
        <Link
          href="/"
          className="px-6 py-3 rounded-full bg-primary text-background font-semibold hover:bg-primary/80 transition-colors"
        >
          Back to Home
        </Link>
      </motion.div>
    </section>
  )
}

"use client"

import { useEffect, useRef } from "react"
import { XIcon } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

interface FilterDrawerProps {
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
}

export function FilterDrawer({ isOpen, onClose, children }: FilterDrawerProps) {
    const drawerRef = useRef<HTMLDivElement>(null)

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    // Focus trap
    useEffect(() => {
        if (isOpen && drawerRef.current) {
            const firstFocusable = drawerRef.current.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            )
            firstFocusable?.focus()
        }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className='fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden'
                        onClick={onClose}
                    />

                    {/* Drawer */}
                    <motion.div
                        ref={drawerRef}
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{
                            type: "spring",
                            damping: 30,
                            stiffness: 300,
                        }}
                        className='fixed top-0 right-0 bottom-0 z-50 w-[85vw] max-w-sm overflow-y-auto bg-background border-l border-border lg:hidden'
                    >
                        <div className='sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border bg-background'>
                            <h2 className='text-sm font-semibold'>Filters</h2>
                            <button
                                onClick={onClose}
                                className='p-1.5 rounded-md hover:bg-text/5 transition-colors cursor-pointer'
                                aria-label='Close filters'
                            >
                                <XIcon className='h-4 w-4 text-text/50' />
                            </button>
                        </div>
                        <div className='p-4'>{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

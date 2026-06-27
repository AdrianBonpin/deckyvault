// components/ui/screenshot-lightbox.tsx
"use client"

import { useState, useCallback, useEffect } from "react"
import { AnimatePresence, motion } from "motion/react"
import { XIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

interface ScreenshotLightboxProps {
  screenshots: Array<{ id: string; url: string; width: number; height: number }>
  initialIndex: number
  onClose: () => void
}

export function ScreenshotLightbox({
  screenshots,
  initialIndex,
  onClose,
}: ScreenshotLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)
  const hasMultiple = screenshots.length > 1

  const goNext = useCallback(() => {
    setZoomed(false)
    setCurrentIndex((prev) => (prev < screenshots.length - 1 ? prev + 1 : prev))
  }, [screenshots.length])

  const goPrev = useCallback(() => {
    setZoomed(false)
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev))
  }, [])

  const toggleZoom = useCallback(() => {
    setZoomed((z) => !z)
  }, [])

  // Keyboard handlers
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowRight" && hasMultiple) {
        goNext()
      } else if (e.key === "ArrowLeft" && hasMultiple) {
        goPrev()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, goNext, goPrev, hasMultiple])

  const current = screenshots[currentIndex]
  if (!current) return null

  return (
    <AnimatePresence>
      <motion.div
        key="lightbox-backdrop"
        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10 cursor-pointer"
          aria-label="Close"
        >
          <XIcon className="h-5 w-5 text-white" />
        </button>

        {/* Previous arrow */}
        {hasMultiple && currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10 cursor-pointer"
            aria-label="Previous screenshot"
          >
            <ChevronLeftIcon className="h-6 w-6 text-white" />
          </button>
        )}

        {/* Next arrow */}
        {hasMultiple && currentIndex < screenshots.length - 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10 cursor-pointer"
            aria-label="Next screenshot"
          >
            <ChevronRightIcon className="h-6 w-6 text-white" />
          </button>
        )}

        {/* Image container — scrollable for panning when zoomed */}
        <div
          className="flex items-center justify-center w-full h-full overflow-auto"
          style={{ touchAction: zoomed ? "pan-x pan-y" : "pinch-zoom" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={`Screenshot ${currentIndex + 1}`}
            className={`transition-transform duration-200 ${
              zoomed
                ? "max-w-none cursor-zoom-out"
                : "max-w-[90vw] max-h-[90vh] object-contain cursor-zoom-in"
            }`}
            style={zoomed ? { width: current.width, height: current.height } : undefined}
            onClick={toggleZoom}
            draggable={false}
          />
        </div>

        {/* Counter */}
        {hasMultiple && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-medium">
            {currentIndex + 1} / {screenshots.length}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

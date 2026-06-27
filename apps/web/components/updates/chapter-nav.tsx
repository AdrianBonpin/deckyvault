"use client"

import { useEffect, useState } from "react"
import { ListIcon } from "lucide-react"
import type { UpdateHeading } from "@/lib/updates"

export function ChapterNav({
  headings,
}: {
  headings: UpdateHeading[]
}) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "")
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id)
      if (!element) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveId(heading.id)
            }
          })
        },
        {
          rootMargin: "-20% 0px -70% 0px",
        },
      )
      observer.observe(element)
      observers.push(observer)
    })

    return () => {
      observers.forEach((observer) => observer.disconnect())
    }
  }, [headings])

  if (headings.length === 0) return null

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed bottom-4 right-4 z-50 md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-background border border-border shadow-lg hover:border-border-active transition-colors cursor-pointer"
        aria-label="Toggle chapter navigation"
      >
        <ListIcon className="w-5 h-5" />
      </button>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-45 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <nav
        className={`fixed bottom-16 right-4 z-50 md:z-auto md:static md:block max-h-[50vh] md:max-h-none overflow-y-auto bg-background border border-border rounded-lg p-3 shadow-lg md:shadow-none md:rounded-none md:border-0 md:p-0 md:bg-transparent transition-all md:transition-none ${
          mobileOpen
            ? "block opacity-100"
            : "hidden md:block opacity-0 md:opacity-100"
        }`}
      >
        <h4 className="text-xs uppercase text-text/40 font-semibold mb-2 hidden md:block">
          Chapters
        </h4>
        <ul className="flex flex-col gap-1">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                onClick={() => setMobileOpen(false)}
                className={`block text-sm py-1 transition-colors ${
                  heading.level === 3 ? "pl-3" : ""
                } ${
                  activeId === heading.id
                    ? "text-primary font-medium"
                    : "text-text/60 hover:text-text"
                }`}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

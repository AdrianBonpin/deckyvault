"use client"

import { ReadingProgressBar } from "./reading-progress-bar"
import { ChapterNav } from "./chapter-nav"
import type { UpdateContent } from "@/lib/updates"

export function UpdateViewer({
  update,
}: {
  update: UpdateContent
}) {
  const formattedDate = new Date(update.meta.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <>
      <ReadingProgressBar />
      <div className="w-full max-w-7xl mx-auto px-4 py-8 flex flex-row gap-8">
        {/* Chapter navigation sidebar (desktop) */}
        <aside className="hidden md:block w-48 shrink-0">
          <div className="sticky top-20">
            <ChapterNav headings={update.headings} />
          </div>
        </aside>

        {/* Main content */}
        <article className="flex-1 min-w-0 prose prose-invert lg:proxe-xl">
          <header className="mb-8">
            <div className="flex flex-row items-center gap-2 mb-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                v{update.meta.version}
              </span>
              <time className="text-sm text-text/60">{formattedDate}</time>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">{update.meta.title}</h1>
          </header>
          <div
            className="update-content max-w-none"
            dangerouslySetInnerHTML={{ __html: update.html }}
          />
        </article>
      </div>

      {/* Mobile chapter nav (rendered inside viewer for context) */}
      <div className="md:hidden">
        <ChapterNav headings={update.headings} />
      </div>
    </>
  )
}

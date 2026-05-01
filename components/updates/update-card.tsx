import Link from "next/link"
import type { UpdateMeta } from "@/lib/updates"

export function UpdateCard({ update }: { update: UpdateMeta }) {
  const formattedDate = new Date(update.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <Link href={`/updates/${update.slug}`}>
      <article className="group flex flex-col gap-2 p-4 rounded-lg border border-border hover:border-border-active hover:bg-text/3 transition-colors">
        <div className="flex flex-row items-center gap-2">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            v{update.version}
          </span>
          <time className="text-xs text-text/60">{formattedDate}</time>
        </div>
        <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
          {update.title}
        </h3>
        <p className="text-sm text-text/60 line-clamp-2">{update.summary}</p>
      </article>
    </Link>
  )
}

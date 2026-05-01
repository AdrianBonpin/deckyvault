import type { Metadata } from "next"
import Link from "next/link"
import { getAllUpdates } from "@/lib/updates"
import { UpdateCard } from "@/components/updates/update-card"
import { ArrowLeftIcon } from "lucide-react"

export const metadata: Metadata = {
  title: "Updates",
  description: "See what's new in DeckyVault — version release notes, features, and improvements.",
}

export default function UpdatesPage() {
  const updates = getAllUpdates()

  return (
    <main className="w-full max-w-2xl mx-auto px-4 py-8">
      <div className="flex flex-row items-center gap-2 mb-6">
        <Link
          href="/"
          className="text-text/60 hover:text-primary transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold">Updates</h1>
      </div>
      <p className="text-text/60 mb-8">
        Release notes and changelogs for every DeckyVault version.
      </p>
      {updates.length === 0 ? (
        <p className="text-text/40 text-center py-16">No updates yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {updates.map((update) => (
            <UpdateCard key={update.slug} update={update} />
          ))}
        </div>
      )}
    </main>
  )
}

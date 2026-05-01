import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { getAllUpdateSlugs, getUpdateBySlug } from "@/lib/updates"
import { UpdateViewer } from "@/components/updates/update-viewer"

export async function generateStaticParams() {
  const slugs = getAllUpdateSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  let update
  try {
    update = await getUpdateBySlug(slug)
  } catch {
    return { title: "Update Not Found" }
  }
  return {
    title: `${update.meta.title} | DeckyVault`,
    description: update.meta.summary,
  }
}

export default async function UpdatePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  let update
  try {
    update = await getUpdateBySlug(slug)
  } catch {
    notFound()
  }

  return (
    <main className="w-full">
      <div className="w-full max-w-4xl mx-auto px-4 pt-4">
        <Link
          href="/updates"
          className="inline-flex items-center gap-1 text-sm text-text/60 hover:text-primary transition-colors"
        >
          <ArrowLeftIcon className="w-3 h-3" />
          Back to updates
        </Link>
      </div>
      <UpdateViewer update={update} />
    </main>
  )
}

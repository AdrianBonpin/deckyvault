import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { remark } from "remark"
import remarkRehype from "remark-rehype"
import rehypeSlug from "rehype-slug"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeStringify from "rehype-stringify"

export interface UpdateMeta {
  slug: string
  title: string
  date: string
  version: string
  summary: string
}

export interface UpdateHeading {
  id: string
  text: string
  level: number
}

export interface UpdateContent {
  meta: UpdateMeta
  html: string
  headings: UpdateHeading[]
}

const UPDATES_DIR = path.join(process.cwd(), "content", "updates")

function getSlugs(): string[] {
  if (!fs.existsSync(UPDATES_DIR)) return []
  return fs
    .readdirSync(UPDATES_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""))
}

export function getAllUpdates(): UpdateMeta[] {
  const slugs = getSlugs()
  const updates = slugs.map((slug) => {
    const { meta } = getUpdateMeta(slug)
    return meta
  })
  // Sort by date descending (newest first)
  return updates.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

function getUpdateMeta(slug: string): { meta: UpdateMeta } {
  const filePath = path.join(UPDATES_DIR, `${slug}.md`)
  const fileContents = fs.readFileSync(filePath, "utf8")
  const { data } = matter(fileContents)

  return {
    meta: {
      slug,
      title: data.title ?? "",
      date: data.date ?? "",
      version: data.version ?? "",
      summary: data.summary ?? "",
    },
  }
}

export async function getUpdateBySlug(slug: string): Promise<UpdateContent> {
  const filePath = path.join(UPDATES_DIR, `${slug}.md`)
  const fileContents = fs.readFileSync(filePath, "utf8")
  const { data, content } = matter(fileContents)

  const processedContent = await remark()
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings)
    .use(rehypeStringify)
    .process(content)

  const html = processedContent.toString()

  // Extract headings from the rendered HTML
  const headingRegex = /<h([1-6])[^>]*id=["']([^"']+)["'][^>]*>(.*?)<\/h[1-6]>/g
  const headings: UpdateHeading[] = []
  let match: RegExpExecArray | null
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      text: match[3].replace(/<[^>]*>/g, ""), // Strip any inner HTML tags
      id: match[2],
    })
  }

  return {
    meta: {
      slug,
      title: data.title ?? "",
      date: data.date ?? "",
      version: data.version ?? "",
      summary: data.summary ?? "",
    },
    html,
    headings,
  }
}

export function getAllUpdateSlugs(): string[] {
  return getSlugs()
}
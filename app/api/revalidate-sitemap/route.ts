import { revalidatePath, revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

/**
 * On-demand sitemap revalidation webhook.
 *
 * What this endpoint does:
 *   Revalidates the `/sitemap.xml` path so Next.js regenerates the sitemap
 *   at the edge instead of waiting for the next ISR interval.
 *
 * When to call it:
 *   - After adding, updating, or removing games
 *   - After adding, updating, or removing hardware
 *   - After any bulk import or migration that affects public-facing URLs
 *
 * How to call it:
 *   ```bash
 *   curl -X POST https://<your-domain>/api/revalidate-sitemap \
 *     -H "Authorization: Bearer $REVALIDATE_SECRET"
 *   ```
 *
 * @see https://nextjs.org/docs/app/building-your-application/caching#on-demand-revalidation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization")
  const secret = process.env.REVALIDATE_SECRET

  if (!secret) {
    return NextResponse.json(
      { error: "Revalidation not configured. Set REVALIDATE_SECRET env var." },
      { status: 503 },
    )
  }

  const token = authHeader?.replace("Bearer ", "")
  if (token !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 })
  }

  try {
    revalidateTag("sitemap", "default")
    revalidatePath("/sitemap.xml")
    return NextResponse.json({
      revalidated: true,
      path: "/sitemap.xml",
      now: Date.now(),
    })
  } catch (error) {
    console.error("[Revalidate Sitemap] Failed:", error)
    return NextResponse.json(
      { error: "Revalidation failed" },
      { status: 500 },
    )
  }
}

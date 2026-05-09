import type { Metadata } from "next"
import { db } from "@/lib/db/index"
import { sql } from "drizzle-orm"
import { DashboardClient } from "@/components/dashboard/dashboard-client"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Dashboard — DeckyVault",
  description:
    "Community dashboard with trending games, best new releases, and most tested games on DeckyVault.",
  keywords: [
    "Steam Deck dashboard",
    "trending games",
    "best new releases",
    "game benchmarks",
    "community insights",
  ],
  alternates: { canonical: "https://deckyvault.xyz/dashboard" },
  openGraph: {
    title: "Dashboard — DeckyVault",
    description:
      "Community dashboard with trending games, best new releases, and most tested games.",
    url: "https://deckyvault.xyz/dashboard",
    siteName: "DeckyVault",
    type: "website",
  },
}

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

export default async function DashboardPage() {
  const trending = await db.execute(sql`
    WITH recent_benchmarks AS (
      SELECT gv.game_id, COUNT(*) AS cnt
      FROM performance_entries pe
      JOIN game_versions gv ON pe.version_id = gv.id
      WHERE pe.is_removed = false
        AND pe.created_at >= ${SEVEN_DAYS_AGO}
      GROUP BY gv.game_id
    ),
    recent_comments AS (
      SELECT gc.game_id, COUNT(*) AS cnt
      FROM game_comments gc
      WHERE gc.is_removed = false
        AND gc.created_at >= ${SEVEN_DAYS_AGO}
      GROUP BY gc.game_id
    ),
    recent_upvotes AS (
      SELECT gv.game_id, SUM(pe.upvotes) AS total_upvotes
      FROM performance_entries pe
      JOIN game_versions gv ON pe.version_id = gv.id
      WHERE pe.is_removed = false
        AND pe.updated_at >= ${SEVEN_DAYS_AGO}
      GROUP BY gv.game_id
    )
    SELECT
      g.id,
      g.title,
      g.capsule_image,
      g.header_image,
      g.playability_status,
      COALESCE(rb.cnt, 0) AS benchmark_count,
      COALESCE(rc.cnt, 0) AS comment_count,
      COALESCE(ru.total_upvotes, 0) AS upvote_count,
      (COALESCE(rb.cnt, 0) * 3 + COALESCE(rc.cnt, 0) * 2 + COALESCE(ru.total_upvotes, 0) * 1) AS activity_score
    FROM games g
    LEFT JOIN recent_benchmarks rb ON rb.game_id = g.id
    LEFT JOIN recent_comments rc ON rc.game_id = g.id
    LEFT JOIN recent_upvotes ru ON ru.game_id = g.id
    WHERE (rb.cnt IS NOT NULL OR rc.cnt IS NOT NULL OR ru.total_upvotes IS NOT NULL)
    ORDER BY activity_score DESC
    LIMIT 10
  `)

  const bestNew = await db.execute(sql`
    SELECT
      g.id,
      g.title,
      g.capsule_image,
      g.header_image,
      g.release_date,
      g.created_at,
      g.playability_status,
      AVG(pe.fps_avg) AS avg_fps,
      COUNT(pe.id) AS benchmark_count
    FROM games g
    JOIN game_versions gv ON gv.game_id = g.id
    JOIN performance_entries pe ON pe.version_id = gv.id
    WHERE pe.is_removed = false
      AND (g.created_at >= ${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
           OR g.release_date IS NOT NULL)
    GROUP BY g.id, g.title, g.capsule_image, g.header_image, g.release_date, g.created_at, g.playability_status
    HAVING COUNT(pe.id) >= 3
    ORDER BY avg_fps DESC
    LIMIT 10
  `)

  const mostTested = await db.execute(sql`
    SELECT
      g.id,
      g.title,
      g.capsule_image,
      g.header_image,
      g.playability_status,
      COUNT(pe.id) AS benchmark_count
    FROM games g
    JOIN game_versions gv ON gv.game_id = g.id
    JOIN performance_entries pe ON pe.version_id = gv.id
    WHERE pe.is_removed = false
    GROUP BY g.id, g.title, g.capsule_image, g.header_image, g.playability_status
    ORDER BY benchmark_count DESC
    LIMIT 10
  `)

  const mostReported = await db.execute(sql`
    SELECT
      g.id,
      g.title,
      g.capsule_image,
      g.header_image,
      COUNT(DISTINCT r.id) AS report_count
    FROM games g
    JOIN game_versions gv ON gv.game_id = g.id
    JOIN performance_entries pe ON pe.version_id = gv.id
    JOIN reports r ON r.entry_id = pe.id
    WHERE r.status = 'open'
    GROUP BY g.id, g.title, g.capsule_image, g.header_image
    ORDER BY report_count DESC
    LIMIT 10
  `)

  // Serialize rows for the client component
  const serializedTrending = trending.rows.map((row: any) => ({
    id: String(row.id),
    title: String(row.title),
    capsule_image: row.capsule_image ? String(row.capsule_image) : null,
    header_image: row.header_image ? String(row.header_image) : null,
    playability_status: row.playability_status ? String(row.playability_status) : null,
    benchmark_count: Number(row.benchmark_count ?? 0),
    comment_count: Number(row.comment_count ?? 0),
    upvote_count: Number(row.upvote_count ?? 0),
    activity_score: Number(row.activity_score ?? 0),
  }))

  const serializedBestNew = bestNew.rows.map((row: any) => ({
    id: String(row.id),
    title: String(row.title),
    capsule_image: row.capsule_image ? String(row.capsule_image) : null,
    header_image: row.header_image ? String(row.header_image) : null,
    release_date: row.release_date ? new Date(row.release_date).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    playability_status: row.playability_status ? String(row.playability_status) : null,
    avg_fps: row.avg_fps ? Number(row.avg_fps) : null,
    benchmark_count: Number(row.benchmark_count ?? 0),
  }))

  const serializedMostTested = mostTested.rows.map((row: any) => ({
    id: String(row.id),
    title: String(row.title),
    capsule_image: row.capsule_image ? String(row.capsule_image) : null,
    header_image: row.header_image ? String(row.header_image) : null,
    playability_status: row.playability_status ? String(row.playability_status) : null,
    benchmark_count: Number(row.benchmark_count ?? 0),
  }))

  const serializedMostReported = mostReported.rows.map((row: any) => ({
    id: String(row.id),
    title: String(row.title),
    capsule_image: row.capsule_image ? String(row.capsule_image) : null,
    header_image: row.header_image ? String(row.header_image) : null,
    report_count: Number(row.report_count ?? 0),
  }))

  return (
    <DashboardClient
      trending={serializedTrending}
      bestNew={serializedBestNew}
      mostTested={serializedMostTested}
      mostReported={serializedMostReported}
    />
  )
}

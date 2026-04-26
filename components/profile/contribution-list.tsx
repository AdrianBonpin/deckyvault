"use client"

import Image from "next/image"
import Link from "next/link"
import { Cpu, Clock, TrendingUp, CheckCircle } from "lucide-react"
import { motion } from "motion/react"
import type { ContributionEntry } from "@/types/api"

interface ContributionListProps {
  entries: ContributionEntry[]
  showViewAll?: boolean
  totalCount?: number
}

export function ContributionList({ entries, showViewAll = false, totalCount }: ContributionListProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-text/40">
        <TrendingUp className="h-8 w-8 mx-auto mb-2" />
        <p>No contributions yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {showViewAll && totalCount && totalCount > entries.length && (
        <div className="flex justify-end">
          <span className="text-xs text-text/40">
            Showing {entries.length} of {totalCount}
          </span>
        </div>
      )}
      {entries.map((entry, i) => (
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Link
            href={`/game/${entry.gameId}`}
            className="flex items-center gap-4 p-3 rounded-lg bg-text/5 border border-border hover:border-primary/30 transition-colors"
          >
            {entry.gameHeaderImage ? (
              <Image
                src={entry.gameHeaderImage}
                alt={entry.gameTitle}
                width={80}
                height={36}
                unoptimized
                className="rounded h-9 w-20 object-cover shrink-0"
              />
            ) : (
              <div className="h-9 w-20 rounded bg-text/10 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{entry.gameTitle}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-text/50">
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  {entry.hardwareName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-sm font-bold text-primary">
                {entry.fpsAvg.toFixed(0)} FPS
              </div>
              {entry.verifiedAt && (
                <div className="flex items-center gap-1 text-xs text-green-400 mt-0.5">
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </div>
              )}
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}

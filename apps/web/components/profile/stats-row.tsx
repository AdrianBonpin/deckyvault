"use client"

import { TrendingUp, CheckCircle, Star } from "lucide-react"
import { motion } from "motion/react"

interface StatsRowProps {
  contributions: number
  verifiedEntries: number
  reputation: number
}

export function StatsRow({ contributions, verifiedEntries, reputation }: StatsRowProps) {
  const stats = [
    { label: "Contributions", value: contributions, icon: TrendingUp, color: "text-primary" },
    { label: "Verified", value: verifiedEntries, icon: CheckCircle, color: "text-green-400" },
    { label: "Reputation", value: reputation, icon: Star, color: "text-accent" },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-3 gap-4"
    >
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center p-4 rounded-xl bg-text/5 border border-border"
        >
          <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
          <span className="text-2xl font-bold">{stat.value}</span>
          <span className="text-xs text-text/50">{stat.label}</span>
        </div>
      ))}
    </motion.div>
  )
}

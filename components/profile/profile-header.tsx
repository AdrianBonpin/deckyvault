"use client"

import Image from "next/image"
import { User, Shield, Crown, CheckCircle } from "lucide-react"
import { motion } from "motion/react"

interface ProfileHeaderProps {
  name: string
  image: string | null
  role: string | null
  verified: boolean
  createdAt: string
}

const roleConfig: Record<string, { label: string; color: string; icon: typeof User }> = {
  admin: { label: "Admin", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Crown },
  contributor: { label: "Contributor", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield },
  user: { label: "Member", color: "bg-text/10 text-text/60 border-text/20", icon: User },
}

export function ProfileHeader({ name, image, role, verified, createdAt }: ProfileHeaderProps) {
  const config = roleConfig[role || "user"] || roleConfig.user
  const RoleIcon = config.icon

  const joinDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6"
    >
      <div className="relative shrink-0">
        {image ? (
          <Image
            src={image}
            alt={name}
            width={96}
            height={96}
            unoptimized
            className="h-24 w-24 rounded-full border-2 border-border"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-secondary/50 border-2 border-border flex items-center justify-center">
            <User className="h-10 w-10 text-text/40" />
          </div>
        )}
        {verified && (
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
        )}
      </div>

      <div className="text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <h1 className="text-2xl font-bold">{name}</h1>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
            <RoleIcon className="h-3 w-3" />
            {config.label}
          </span>
        </div>
        <p className="text-sm text-text/50 mt-1">Member since {joinDate}</p>
      </div>
    </motion.div>
  )
}

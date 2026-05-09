"use client"

import { Shield, Crown, CheckCircle, Mail } from "lucide-react"
import { motion } from "motion/react"

interface ProfileHeaderProps {
  name: string
  email?: string
  role: string | null
  verified: boolean
  createdAt: string
  image?: string | null
}

const roleConfig: Record<string, { label: string; color: string; icon: typeof Crown }> = {
  admin: { label: "Admin", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Crown },
  contributor: { label: "Contributor", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Shield },
  user: { label: "Member", color: "bg-text/10 text-text/60 border-text/20", icon: Shield },
}

function isR2Avatar(url: string): boolean {
  return url.includes(".r2.dev")
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase()
}

export function ProfileHeader({ name, email, role, verified, createdAt, image }: ProfileHeaderProps) {
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
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-3">
        {image ? (
          <div className={`shrink-0 w-16 h-16 rounded-full overflow-hidden ${isR2Avatar(image) ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={`${name}'s profile photo`} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="shrink-0 w-16 h-16 rounded-full overflow-hidden flex items-center justify-center bg-primary/10 text-primary text-xl font-bold">
            {getInitials(name)}
          </div>
        )}
        <h1 className="text-2xl font-bold">{name}</h1>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
          <RoleIcon className="h-3 w-3" />
          {config.label}
        </span>
        {verified && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
            <CheckCircle className="h-3 w-3" />
            Verified
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-text/50">
        <span>Member since {joinDate}</span>
        {email && (
          <>
            <span>&middot;</span>
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {email}
            </span>
          </>
        )}
      </div>
    </motion.div>
  )
}

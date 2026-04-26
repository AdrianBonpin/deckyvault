"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { ProfileHeader } from "@/components/profile/profile-header"
import { StatsRow } from "@/components/profile/stats-row"
import { ContributionList } from "@/components/profile/contribution-list"
import { Bookmark, Settings, Loader2 } from "lucide-react"
import { motion } from "motion/react"
import type { ContributionEntry } from "@/types/api"

type Tab = "overview" | "saved" | "settings"

export default function ProfilePage() {
  const router = useRouter()
  const { data: session, isPending: isSessionLoading } = useSession()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [profile, setProfile] = useState<{
    id: string
    name: string
    email: string
    image: string | null
    role: string | null
    createdAt: string
    contributions: number
    verifiedEntries: number
    reputation: number
    verified: boolean
  } | null>(null)
  const [contributions, setContributions] = useState<ContributionEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isSessionLoading && !session) {
      router.push("/login")
    }
  }, [session, isSessionLoading, router])

  useEffect(() => {
    if (!session) return

    async function fetchProfile() {
      try {
        const [profileRes, contribRes] = await Promise.all([
          fetch("/api/user/me"),
          fetch("/api/user/profile/" + session!.user.id + "/contributions?limit=10"),
        ])

        if (profileRes.ok) {
          setProfile(await profileRes.json())
        }
        if (contribRes.ok) {
          const data = await contribRes.json()
          setContributions(data.data)
        }
      } catch (err) {
        console.error("Failed to fetch profile:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [session])

  if (isSessionLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session || !profile) {
    return null
  }

  const tabs: { id: Tab; label: string; icon: typeof Bookmark }[] = [
    { id: "overview", label: "Overview", icon: Settings },
    { id: "saved", label: "Saved Games", icon: Bookmark },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <ProfileHeader
        name={profile.name}
        image={profile.image}
        role={profile.role}
        verified={profile.verified}
        createdAt={profile.createdAt}
      />

      <StatsRow
        contributions={profile.contributions}
        verifiedEntries={profile.verifiedEntries}
        reputation={profile.reputation}
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-text/50 hover:text-text/70"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === "overview" && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Recent Contributions</h2>
            <ContributionList entries={contributions} />
          </div>
        )}

        {activeTab === "saved" && (
          <div className="text-center py-12 text-text/40">
            <Bookmark className="h-8 w-8 mx-auto mb-2" />
            <p>Saved games will appear here</p>
            <p className="text-xs mt-1">Feature coming in the next update</p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="text-center py-12 text-text/40">
            <Settings className="h-8 w-8 mx-auto mb-2" />
            <p>Account settings will appear here</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}

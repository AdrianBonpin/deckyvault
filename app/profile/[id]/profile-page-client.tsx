"use client"

import { ProfileHeader } from "@/components/profile/profile-header"
import { StatsRow } from "@/components/profile/stats-row"
import { ContributionList } from "@/components/profile/contribution-list"
import type { ContributionEntry } from "@/types/api"

interface ProfilePageClientProps {
  profile: {
    id: string
    name: string
    image: string | null
    role: string | null
    createdAt: string
    contributions: number
    verifiedEntries: number
    reputation: number
    verified: boolean
  }
  recentContributions: ContributionEntry[]
}

export function ProfilePageClient({ profile, recentContributions }: ProfilePageClientProps) {
  return (
    <div className="w-full flex flex-col gap-8 pb-16">
      <div className="px-4 md:px-[10svw]">
        <div className="max-w-7xl mx-auto">
          <ProfileHeader
            name={profile.name}
            role={profile.role}
            verified={profile.verified}
            createdAt={profile.createdAt}
          />
        </div>
      </div>

      <div className="px-4 md:px-[10svw]">
        <div className="max-w-7xl mx-auto">
          <StatsRow
            contributions={profile.contributions}
            verifiedEntries={profile.verifiedEntries}
            reputation={profile.reputation}
          />
        </div>
      </div>

      <div className="px-4 md:px-[10svw]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold mb-4">Recent Contributions</h2>
          <ContributionList
            entries={recentContributions}
            showViewAll
            totalCount={profile.contributions}
          />
        </div>
      </div>
    </div>
  )
}

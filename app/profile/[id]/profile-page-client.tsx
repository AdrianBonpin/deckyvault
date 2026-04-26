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
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
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

      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Contributions</h2>
        <ContributionList
          entries={recentContributions}
          showViewAll
          totalCount={profile.contributions}
        />
      </div>
    </div>
  )
}

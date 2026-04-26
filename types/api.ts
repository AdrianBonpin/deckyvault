export type ApiError = {
  error: string
  code?: string
  status: number
}

export type ContributionEntry = {
  id: string
  fpsAvg: number
  fpsLow: number | null
  fpsHigh: number | null
  hardwareSlug: string
  hardwareName: string
  upscalerType: string
  upscalerVersion: string | null
  frameGenMethod: string
  verifiedAt: string | null
  createdAt: string
  gameTitle: string
  gameId: string
  gameHeaderImage: string | null
}

export type UserProfile = {
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
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
}

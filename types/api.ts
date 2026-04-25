export type ApiError = {
  error: string
  code?: string
  status: number
}

export type UserProfile = {
  id: string
  name: string
  email: string
  image: string | null
  role: string | null
  createdAt: string
  contributions: number
  reputation: number
  verified: boolean
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  limit: number
  offset: number
}

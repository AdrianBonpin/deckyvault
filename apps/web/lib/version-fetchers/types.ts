/** Result from a single version-fetch strategy */
export interface VersionFetchResult {
  /** Human-readable version string like "1.2.3" or "Patch 4.0" */
  versionString: string | null
  /** Numeric build ID from Steam */
  buildId: string | null
  /** Which strategy produced this result */
  source: string
  /** Whether the strategy succeeded (even if partial — e.g. buildId only) */
  success: boolean
  /** Error message if strategy failed completely */
  error?: string
}

/** A version-fetch strategy function */
export type VersionFetchStrategy = (
  steamAppId: number,
) => Promise<VersionFetchResult>

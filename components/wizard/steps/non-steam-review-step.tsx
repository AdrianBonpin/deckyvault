"use client"

import { ImageIcon, Monitor, Info, FileText, Link, Calendar } from "lucide-react"
import { BasicInfoData } from "./non-steam-basic-info-step"
import { PlatformSupportItem } from "./non-steam-platform-step"

interface NonSteamReviewStepProps {
  basicInfo: BasicInfoData
  headerImage: string
  capsuleImage: string
  platformSupport: PlatformSupportItem[]
  onSubmit: () => void
  isSubmitting: boolean
  error: string | null
}

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-semibold text-text/80 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-b-0">
      <span className="text-xs text-text/50">{label}</span>
      <span className="text-xs text-text font-medium">{value}</span>
    </div>
  )
}

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual Entry",
  gog: "GOG",
  epic: "Epic Games Store",
}

const PROTON_LABELS: Record<string, string> = {
  native: "Native",
  proton: "Proton",
  unsupported: "Unsupported",
  unknown: "Unknown",
}

export function NonSteamReviewStep({
  basicInfo,
  headerImage,
  capsuleImage,
  platformSupport,
  onSubmit,
  isSubmitting,
  error,
}: NonSteamReviewStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Review & Submit</h3>
          <p className="text-xs text-text/60 mt-1">
            Review all details before submitting the game to DeckyVault.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Basic Info */}
        <div className="rounded-lg border border-border bg-text/5 p-4">
          <SectionHeader icon={FileText} label="Basic Info" />
          <SummaryRow label="Title" value={basicInfo.title || "—"} />
          <SummaryRow label="Source" value={SOURCE_LABELS[basicInfo.source] || basicInfo.source} />
          <SummaryRow label="Developer" value={basicInfo.developer || "—"} />
          <SummaryRow label="Publisher" value={basicInfo.publisher || "—"} />
          <SummaryRow
            label="Genres"
            value={
              basicInfo.genres.length > 0 ? basicInfo.genres.join(", ") : "—"
            }
          />
          <SummaryRow label="Release Date" value={basicInfo.releaseDate || "—"} />
          {basicInfo.storeUrl && (
            <SummaryRow
              label="Store URL"
              value={
                <a
                  href={basicInfo.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate max-w-[200px] block"
                >
                  <span className="inline-flex items-center gap-1">
                    <Link className="h-3 w-3" />
                    {basicInfo.storeUrl}
                  </span>
                </a>
              }
            />
          )}
          {basicInfo.description && (
            <div className="mt-2">
              <p className="text-[10px] text-text/40 mb-1">Description</p>
              <p className="text-[11px] text-text/70 leading-relaxed">{basicInfo.description}</p>
            </div>
          )}
        </div>

        {/* Cover Art */}
        <div className="rounded-lg border border-border bg-text/5 p-4">
          <SectionHeader icon={ImageIcon} label="Cover Art" />
          {(headerImage || capsuleImage) ? (
            <div className="w-28 aspect-[2/3] rounded-lg overflow-hidden border border-border bg-text/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={capsuleImage || headerImage}
                alt="Cover preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <p className="text-xs text-text/40">No cover art selected</p>
          )}
        </div>

        {/* Platform Support */}
        <div className="rounded-lg border border-border bg-text/5 p-4 lg:col-span-2">
          <SectionHeader icon={Monitor} label="Platform Support" />
          {platformSupport.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {platformSupport.map((ps) => (
                <span
                  key={ps.hardwareSlug}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${
                    ps.isSupported
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-text/5 text-text/40"
                  }`}
                >
                  {ps.isSupported ? (
                    <>
                      {ps.hardwareSlug}
                      <span className="text-text/40">·</span>
                      {PROTON_LABELS[ps.protonStatus] || ps.protonStatus}
                    </>
                  ) : (
                    <>{ps.hardwareSlug} — Unsupported</>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text/40">No platform support configured</p>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Submitting...
          </>
        ) : (
          "Submit Game"
        )}
      </button>
    </div>
  )
}

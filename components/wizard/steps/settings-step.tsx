"use client"

import { SettingsEditor, type SettingCategory } from "@/components/wizard/settings-editor"
import { SlidersHorizontal } from "lucide-react"

interface SettingsStepProps {
  value: SettingCategory[]
  onChange: (value: SettingCategory[]) => void
}

export function SettingsStep({ value, onChange }: SettingsStepProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <SlidersHorizontal className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Game Settings</h3>
          <p className="text-xs text-text/60 mt-1">
            Configure the in-game settings you used during testing. Add categories and settings as needed, or load defaults to get started.
          </p>
        </div>
      </div>

      <SettingsEditor value={value} onChange={onChange} />
    </div>
  )
}

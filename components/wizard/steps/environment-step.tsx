"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Terminal, ChevronDown, Loader2 } from "lucide-react"
import { api } from "@/lib/eden"

const FSR_OPTIONS = [
  { value: "none", label: "None" },
  { value: "fsr1", label: "FSR 1" },
  { value: "fsr2", label: "FSR 2" },
  { value: "fsr3", label: "FSR 3" },
] as const

const FRAME_GEN_OPTIONS = [
  { value: "none", label: "None" },
  { value: "fsr_fg", label: "FSR Frame Generation" },
  { value: "dlss_fg", label: "DLSS Frame Generation" },
] as const

export interface EnvironmentData {
  protonVersion?: string
  osVersion?: string
  fsrVersion?: string
  frameGenMethod?: string
  launchOptions?: string
}

interface EnvironmentStepProps {
  value: EnvironmentData
  onChange: (value: EnvironmentData) => void
}

function AutocompleteInput({
  label,
  placeholder,
  value,
  onChange,
  field,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (val: string) => void
  field: "protonVersion" | "osVersion"
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchSuggestions = useCallback(
    async (query: string) => {
      try {
        setLoading(true)
        const res = await api.performance.autocomplete.get({ query: { field } })
        if (!res.error && res.data?.data) {
          const data = res.data.data
          const filtered = query
            ? data.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
            : data
          setSuggestions(filtered.slice(0, 8))
        }
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    },
    [field]
  )

  const handleFocus = () => {
    setOpen(true)
    fetchSuggestions(inputValue)
  }

  const handleChange = (val: string) => {
    setInputValue(val)
    onChange(val)
    fetchSuggestions(val)
    setOpen(true)
  }

  const handleSelect = (val: string) => {
    setInputValue(val)
    onChange(val)
    setOpen(false)
  }

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-xs font-medium text-text/60">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-text/30" />
        )}

        <AnimatePresence>
          {open && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-[#1a1020] shadow-lg"
            >
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(s)}
                  className="w-full px-4 py-2 text-left text-sm text-text/80 hover:bg-primary/10 hover:text-text transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function EnvironmentStep({ value, onChange }: EnvironmentStepProps) {
  const update = (field: keyof EnvironmentData, val: string) => {
    onChange({ ...value, [field]: val })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Terminal className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-text">Environment</h3>
          <p className="text-xs text-text/60 mt-1">
            Describe the software environment used during testing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AutocompleteInput
          label="Proton Version"
          placeholder="e.g. Proton Experimental"
          value={value.protonVersion ?? ""}
          onChange={(val) => update("protonVersion", val)}
          field="protonVersion"
        />

        <AutocompleteInput
          label="OS Version"
          placeholder="e.g. SteamOS 3.5"
          value={value.osVersion ?? ""}
          onChange={(val) => update("osVersion", val)}
          field="osVersion"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text/60">FSR Version</label>
          <div className="relative">
            <select
              value={value.fsrVersion ?? "none"}
              onChange={(e) => update("fsrVersion", e.target.value)}
              className="w-full appearance-none px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors cursor-pointer"
            >
              {FSR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text/60">Frame Gen Method</label>
          <div className="relative">
            <select
              value={value.frameGenMethod ?? "none"}
              onChange={(e) => update("frameGenMethod", e.target.value)}
              className="w-full appearance-none px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors cursor-pointer"
            >
              {FRAME_GEN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text/40 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text/60">Launch Options</label>
        <textarea
          value={value.launchOptions ?? ""}
          onChange={(e) => update("launchOptions", e.target.value)}
          placeholder="e.g. PROTON_USE_WINED3D=1 %command%"
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors resize-none"
        />
        <p className="text-xs text-text/40">
          Steam launch options or environment variables used.
        </p>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

export interface SettingItem {
  title: string
  value: string | number | boolean
}

export interface SettingCategory {
  category: string
  settings: SettingItem[]
}

const DEFAULT_CATEGORIES: SettingCategory[] = [
  {
    category: "Graphics",
    settings: [
      { title: "Texture Quality", value: "High" },
      { title: "Shadow Quality", value: "Medium" },
      { title: "Anti-Aliasing", value: "TAA" },
      { title: "Effects Quality", value: "High" },
    ],
  },
  {
    category: "Display",
    settings: [
      { title: "Resolution", value: "1280x800" },
      { title: "Refresh Rate", value: 60 },
      { title: "VSync", value: false },
      { title: "Fullscreen", value: true },
    ],
  },
  {
    category: "Audio",
    settings: [
      { title: "Master Volume", value: 80 },
      { title: "SFX Volume", value: 70 },
    ],
  },
]

const typeOptions = [
  { value: "text", label: "Abc" },
  { value: "number", label: "123" },
  { value: "boolean", label: "\u2713/\u2717" },
] as const

interface SettingsEditorProps {
  value: SettingCategory[]
  onChange: (categories: SettingCategory[]) => void
  className?: string
}

export function SettingsEditor({
  value,
  onChange,
  className = "",
}: SettingsEditorProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  )
  const [newCategoryName, setNewCategoryName] = useState("")
  const [newSettingNames, setNewSettingNames] = useState<Record<string, string>>({})
  const [newSettingTypes, setNewSettingTypes] = useState<Record<string, string>>({})
  const addSettingInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const addCategory = () => {
    const name = newCategoryName.trim()
    if (!name) return
    if (value.some((c) => c.category === name)) return

    onChange([...value, { category: name, settings: [] }])
    setNewCategoryName("")
  }

  const removeCategory = (category: string) => {
    onChange(value.filter((c) => c.category !== category))
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      next.delete(category)
      return next
    })
  }

  const addSetting = (category: string) => {
    const name = (newSettingNames[category] || "").trim()
    if (!name) return
    const type = newSettingTypes[category] || "text"
    const defaultValue = type === "boolean" ? false : type === "number" ? 0 : ""
    onChange(
      value.map((c) => {
        if (c.category !== category) return c
        if (c.settings.some((s) => s.title === name)) return c
        return {
          ...c,
          settings: [...c.settings, { title: name, value: defaultValue }],
        }
      })
    )
    setNewSettingNames((prev) => ({ ...prev, [category]: "" }))
    // Refocus after React re-renders
    setTimeout(() => addSettingInputRefs.current[category]?.focus(), 0)
  }

  const moveCategoryUp = (category: string) => {
    const idx = value.findIndex((c) => c.category === category)
    if (idx <= 0) return
    const next = [...value]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  const moveCategoryDown = (category: string) => {
    const idx = value.findIndex((c) => c.category === category)
    if (idx >= value.length - 1) return
    const next = [...value]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  const moveSettingUp = (category: string, settingTitle: string) => {
    onChange(
      value.map((c) => {
        if (c.category !== category) return c
        const idx = c.settings.findIndex((s) => s.title === settingTitle)
        if (idx <= 0) return c
        const next = [...c.settings]
        ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
        return { ...c, settings: next }
      })
    )
  }

  const moveSettingDown = (category: string, settingTitle: string) => {
    onChange(
      value.map((c) => {
        if (c.category !== category) return c
        const idx = c.settings.findIndex((s) => s.title === settingTitle)
        if (idx >= c.settings.length - 1) return c
        const next = [...c.settings]
        ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
        return { ...c, settings: next }
      })
    )
  }

  const removeSetting = (category: string, settingTitle: string) => {
    onChange(
      value.map((c) => {
        if (c.category !== category) return c
        return {
          ...c,
          settings: c.settings.filter((s) => s.title !== settingTitle),
        }
      })
    )
  }

  const updateSetting = (
    category: string,
    settingTitle: string,
    newValue: string | number | boolean
  ) => {
    onChange(
      value.map((c) => {
        if (c.category !== category) return c
        return {
          ...c,
          settings: c.settings.map((s) =>
            s.title === settingTitle ? { ...s, value: newValue } : s
          ),
        }
      })
    )
  }

  const loadDefaults = () => {
    onChange(DEFAULT_CATEGORIES)
    setCollapsedCategories(new Set())
  }

  const isEmpty = value.length === 0
  const [showCustomInput, setShowCustomInput] = useState(false)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showCustomInput && customInputRef.current) {
      customInputRef.current.focus()
    }
  }, [showCustomInput])

  return (
    <div className={`space-y-4 ${className}`}>
      {isEmpty && !showCustomInput && (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg bg-text/5">
          <p className="text-sm text-text/50 mb-4">No settings configured</p>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDefaults}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Load defaults
            </button>
            <button
              onClick={() => setShowCustomInput(true)}
              className="px-4 py-2 rounded-lg border border-border text-text text-sm font-semibold hover:bg-text/5 transition-colors cursor-pointer"
            >
              Create custom
            </button>
          </div>
        </div>
      )}

      {isEmpty && showCustomInput && (
        <div className="rounded-lg border border-dashed border-primary/50 bg-text/5 p-4">
          <label className="text-xs font-medium text-text/60 mb-2 block">Category name</label>
          <div className="flex items-center gap-2">
            <input
              ref={customInputRef}
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  if (newCategoryName.trim()) {
                    addCategory()
                    setShowCustomInput(false)
                  }
                }
              }}
              placeholder="e.g. Graphics, Audio, Display..."
              className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
            />
            <button
              onClick={() => {
                if (newCategoryName.trim()) {
                  addCategory()
                  setShowCustomInput(false)
                }
              }}
              className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Add
            </button>
            <button
              onClick={() => {
                setNewCategoryName("")
                setShowCustomInput(false)
              }}
              className="px-4 py-2.5 rounded-lg border border-border text-text/70 text-sm font-semibold hover:bg-text/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {value.map((cat, index) => {
          const isCollapsed = collapsedCategories.has(cat.category)
          return (
            <motion.div
              key={cat.category}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="border border-border rounded-lg overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-text/5">
                <button
                  onClick={() => toggleCategory(cat.category)}
                  className="flex items-center gap-2 text-sm font-semibold text-text hover:text-text/80 transition-colors cursor-pointer"
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                  {cat.category}
                  <span className="text-xs text-text/40 font-normal">
                    ({cat.settings.length})
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveCategoryUp(cat.category)}
                    disabled={index === 0}
                    className="p-1 rounded-md text-text/30 hover:text-text/60 hover:bg-text/5 transition-colors cursor-pointer disabled:opacity-20"
                    title="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveCategoryDown(cat.category)}
                    disabled={index === value.length - 1}
                    className="p-1 rounded-md text-text/30 hover:text-text/60 hover:bg-text/5 transition-colors cursor-pointer disabled:opacity-20"
                    title="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => removeCategory(cat.category)}
                    className="p-1 rounded-md text-text/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Remove category"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-2 space-y-3">
                      {/* Add setting row at the top */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex items-center gap-1">
                          {typeOptions.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() =>
                                setNewSettingTypes((prev) => ({
                                  ...prev,
                                  [cat.category]: opt.value,
                                }))
                              }
                              className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                                (newSettingTypes[cat.category] || "text") === opt.value
                                  ? "bg-primary text-white border-primary"
                                  : "border-border text-text/60 hover:bg-text/5"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                        <input
                          ref={(el) => {
                            addSettingInputRefs.current[cat.category] = el
                          }}
                          type="text"
                          value={newSettingNames[cat.category] || ""}
                          onChange={(e) =>
                            setNewSettingNames((prev) => ({
                              ...prev,
                              [cat.category]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              addSetting(cat.category)
                            }
                          }}
                          placeholder="Add setting..."
                          className="flex-1 px-3 py-1.5 rounded-md border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                        />
                        <button
                          onClick={() => addSetting(cat.category)}
                          className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer flex-shrink-0"
                          title="Add setting"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <AnimatePresence initial={false}>
                        {cat.settings.map((setting) => (
                          <motion.div
                            key={setting.title}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-3"
                          >
                            <span className="text-sm text-text/80 min-w-[120px] flex-shrink-0">
                              {setting.title}
                            </span>

                            {typeof setting.value === "boolean" ? (
                              <button
                                onClick={() =>
                                  updateSetting(
                                    cat.category,
                                    setting.title,
                                    !setting.value
                                  )
                                }
                                className="flex items-center gap-2 text-sm text-text/60 hover:text-text transition-colors cursor-pointer"
                              >
                                {setting.value ? (
                                  <ToggleRight className="h-5 w-5 text-primary" />
                                ) : (
                                  <ToggleLeft className="h-5 w-5 text-text/40" />
                                )}
                                {setting.value ? "On" : "Off"}
                              </button>
                            ) : (
                              <input
                                type={typeof setting.value === "number" ? "number" : "text"}
                                value={setting.value}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  const updated =
                                    typeof setting.value === "number"
                                      ? raw === ""
                                        ? 0
                                        : Number(raw)
                                      : raw
                                  updateSetting(
                                    cat.category,
                                    setting.title,
                                    updated
                                  )
                                }}
                                className="flex-1 min-w-0 px-3 py-1.5 rounded-md border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                              />
                            )}

                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => moveSettingUp(cat.category, setting.title)}
                                className="p-0.5 rounded text-text/20 hover:text-text/50 hover:bg-text/5 transition-colors cursor-pointer"
                                title="Move up"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => moveSettingDown(cat.category, setting.title)}
                                className="p-0.5 rounded text-text/20 hover:text-text/50 hover:bg-text/5 transition-colors cursor-pointer"
                                title="Move down"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() =>
                                  removeSetting(cat.category, setting.title)
                                }
                                className="p-1 rounded-md text-text/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer flex-shrink-0"
                                title="Remove setting"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {!isEmpty && (
        <div className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCategory()
              }
            }}
            placeholder="New category name..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
          />
          <button
            onClick={addCategory}
            className="px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      )}
    </div>
  )
}

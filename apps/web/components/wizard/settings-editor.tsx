"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
    Plus,
    X,
    ChevronDown,
    ChevronUp,
    GripVertical,
    Copy,
    FileInput,
} from "lucide-react"
import { motion, AnimatePresence, Reorder, useDragControls } from "motion/react"

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

function getTypeMeta(value: string | number | boolean) {
    if (typeof value === "boolean") {
        return {
            label: "\u2713/\u2717",
            className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            title: "Toggle",
            next: "text" as const,
        }
    }
    if (typeof value === "number") {
        return {
            label: "123",
            className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            title: "Number",
            next: "boolean" as const,
        }
    }
    return {
        label: "Abc",
        className: "bg-sky-500/10 text-sky-400 border-sky-500/20",
        title: "Text",
        next: "number" as const,
    }
}

function convertValue(
    current: string | number | boolean,
    targetType: "text" | "number" | "boolean",
): string | number | boolean {
    if (targetType === "boolean") {
        if (typeof current === "boolean") return current
        if (typeof current === "number") return current !== 0
        return current.toLowerCase() === "true"
    }
    if (targetType === "number") {
        if (typeof current === "number") return current
        if (typeof current === "boolean") return current ? 1 : 0
        const parsed = parseInt(current, 10)
        return isNaN(parsed) ? 0 : parsed
    }
    // text
    if (typeof current === "string") return current
    return String(current)
}

function SettingRow({
    setting,
    category,
    onUpdate,
    onRemove,
    onDuplicate,
    onTypeSwitch,
}: {
    setting: SettingItem
    category: string
    onUpdate: (
        cat: string,
        title: string,
        val: string | number | boolean,
    ) => void
    onRemove: (cat: string, title: string) => void
    onDuplicate: (cat: string, title: string) => void
    onTypeSwitch: (cat: string, title: string) => void
}) {
    const dragControls = useDragControls()
    const typeMeta = getTypeMeta(setting.value)

    return (
        <Reorder.Item
            value={setting}
            dragListener={false}
            dragControls={dragControls}
            as="div"
            data-setting-row
            data-category={category}
            data-title={setting.title}
            className="group grid grid-cols-[28px_36px_1fr_1fr_56px] gap-2 items-center rounded-lg border border-border bg-text/3 px-2 py-2 shadow-sm hover:shadow-md hover:bg-text/5 transition-shadow transition-colors"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            whileDrag={{
                scale: 1.01,
                boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
                zIndex: 10,
            }}
        >
            {/* Drag Handle */}
            <div
                className="cursor-grab active:cursor-grabbing p-0.5 rounded text-text/20 hover:text-text/50 hover:bg-text/5 transition-colors flex items-center justify-center select-none touch-none"
                onPointerDown={(e) => { e.preventDefault(); dragControls.start(e) }}
            >
                <GripVertical className="h-4 w-4" />
            </div>

            {/* Type Badge — clickable to cycle type */}
            <button
                type="button"
                onClick={() => onTypeSwitch(category, setting.title)}
                className={`text-[9px] font-bold tracking-wider px-1 py-0.5 rounded border text-center leading-none cursor-pointer hover:brightness-110 transition-all ${typeMeta.className}`}
                title={`${typeMeta.title} — click to switch type`}
            >
                {typeMeta.label}
            </button>

            {/* Label */}
            <span className="text-sm font-medium text-text/90 truncate px-1">
                {setting.title}
            </span>

            {/* Value Control */}
            <div className="min-w-0 flex items-center">
                {typeof setting.value === "boolean" ? (
                    <button
                        onClick={() =>
                            onUpdate(category, setting.title, !setting.value)
                        }
                        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                        style={{
                            backgroundColor: setting.value
                                ? "var(--color-primary, #3b82f6)"
                                : "var(--color-border, #374151)",
                        }}
                    >
                        <span
                            className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
                            style={{
                                transform: setting.value
                                    ? "translateX(22px)"
                                    : "translateX(2px)",
                            }}
                        />
                    </button>
                ) : typeof setting.value === "number" ? (
                    <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={setting.value}
                        onChange={(e) => {
                            const cleaned = e.target.value.replace(
                                /[^0-9]/g,
                                "",
                            )
                            const updated = cleaned === "" ? 0 : Number(cleaned)
                            onUpdate(category, setting.title, updated)
                        }}
                        className="w-full px-3 py-1.5 rounded-md border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors text-right"
                    />
                ) : (
                    <input
                        type="text"
                        value={setting.value}
                        onChange={(e) => {
                            onUpdate(category, setting.title, e.target.value)
                        }}
                        className="w-full px-3 py-1.5 rounded-md border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                    />
                )}
            </div>

            {/* Actions: Duplicate + Remove */}
            <div className="flex items-center justify-end gap-0.5">
                <button
                    onClick={() => onDuplicate(category, setting.title)}
                    className="p-1 rounded-md text-text/30 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Duplicate setting"
                >
                    <Copy className="h-3 w-3" />
                </button>
                <button
                    onClick={() => onRemove(category, setting.title)}
                    className="p-1 rounded-md text-text/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Remove setting"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </Reorder.Item>
    )
}

export function SettingsEditor({
    value,
    onChange,
    className = "",
}: SettingsEditorProps) {
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
        new Set(),
    )
    const [newCategoryName, setNewCategoryName] = useState("")
    const [newSettingNames, setNewSettingNames] = useState<
        Record<string, string>
    >({})
    const [newSettingTypes, setNewSettingTypes] = useState<
        Record<string, string>
    >({})
    const addSettingInputRefs = useRef<Record<string, HTMLInputElement | null>>(
        {},
    )
    const [pasteOpenFor, setPasteOpenFor] = useState<string | null>(null)
    const [pasteText, setPasteText] = useState("")

    const setAddSettingInputRef = useCallback(
        (category: string) => (el: HTMLInputElement | null) => {
            addSettingInputRefs.current[category] = el
        },
        [],
    )

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

    const collapseAll = () => {
        setCollapsedCategories(new Set(value.map((c) => c.category)))
    }

    const expandAll = () => {
        setCollapsedCategories(new Set())
    }

    const allCollapsed =
        value.length > 0 && collapsedCategories.size === value.length
    const allExpanded = collapsedCategories.size === 0

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
        const defaultValue =
            type === "boolean" ? false : type === "number" ? 0 : ""
        onChange(
            value.map((c) => {
                if (c.category !== category) return c
                if (c.settings.some((s) => s.title === name)) return c
                return {
                    ...c,
                    settings: [
                        ...c.settings,
                        { title: name, value: defaultValue },
                    ],
                }
            }),
        )
        setNewSettingNames((prev) => ({ ...prev, [category]: "" }))
        // Refocus after React re-renders
        setTimeout(() => addSettingInputRefs.current[category]?.focus(), 0)
    }

    const removeSetting = (category: string, settingTitle: string) => {
        onChange(
            value.map((c) => {
                if (c.category !== category) return c
                return {
                    ...c,
                    settings: c.settings.filter(
                        (s) => s.title !== settingTitle,
                    ),
                }
            }),
        )
    }

    const duplicateSetting = (category: string, settingTitle: string) => {
        onChange(
            value.map((c) => {
                if (c.category !== category) return c
                const idx = c.settings.findIndex((s) => s.title === settingTitle)
                if (idx === -1) return c
                const original = c.settings[idx]

                // Find a unique title
                let copyTitle = `${original.title} (copy)`
                let n = 2
                while (c.settings.some((s) => s.title === copyTitle)) {
                    copyTitle = `${original.title} (copy ${n})`
                    n++
                }

                const next = [...c.settings]
                next.splice(idx + 1, 0, {
                    title: copyTitle,
                    value: original.value,
                })
                return { ...c, settings: next }
            }),
        )
    }

    const cycleSettingType = (category: string, settingTitle: string) => {
        onChange(
            value.map((c) => {
                if (c.category !== category) return c
                return {
                    ...c,
                    settings: c.settings.map((s) => {
                        if (s.title !== settingTitle) return s
                        const meta = getTypeMeta(s.value)
                        return { ...s, value: convertValue(s.value, meta.next) }
                    }),
                }
            }),
        )
    }

    const updateSetting = (
        category: string,
        settingTitle: string,
        newValue: string | number | boolean,
    ) => {
        onChange(
            value.map((c) => {
                if (c.category !== category) return c
                return {
                    ...c,
                    settings: c.settings.map((s) =>
                        s.title === settingTitle
                            ? { ...s, value: newValue }
                            : s,
                    ),
                }
            }),
        )
    }

    const handleReorderSettings = (
        category: string,
        newSettings: SettingItem[],
    ) => {
        onChange(
            value.map((c) => {
                if (c.category !== category) return c
                return { ...c, settings: newSettings }
            }),
        )
    }

    const parsePaste = (category: string) => {
        const lines = pasteText.split("\n")
        const newSettings: SettingItem[] = []

        for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            // Match: Key = Value, Key: Value, Key - Value
            const match = trimmed.match(/^(.+?)\s*[:=\-]\s*(.+)$/)
            if (!match) continue
            const [, rawKey, rawVal] = match
            const key = rawKey.trim()
            const val = rawVal.trim()
            if (!key || !val) continue

            // Detect type
            const lower = val.toLowerCase()
            let parsedValue: string | number | boolean = val
            if (
                lower === "true" ||
                lower === "false" ||
                lower === "on" ||
                lower === "off" ||
                lower === "yes" ||
                lower === "no"
            ) {
                parsedValue =
                    lower === "true" || lower === "on" || lower === "yes"
            } else if (/^-?\d+$/.test(val)) {
                parsedValue = Number(val)
            }

            newSettings.push({ title: key, value: parsedValue })
        }

        if (newSettings.length === 0) return

        onChange(
            value.map((c) => {
                if (c.category !== category) return c
                const existingTitles = new Set(c.settings.map((s) => s.title))
                const uniqueNew = newSettings.filter(
                    (s) => !existingTitles.has(s.title),
                )
                return {
                    ...c,
                    settings: [...c.settings, ...uniqueNew],
                }
            }),
        )

        setPasteText("")
        setPasteOpenFor(null)
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

    // Keyboard reorder: Alt + ArrowUp/ArrowDown
    const valueRef = useRef(value)
    const onChangeRef = useRef(onChange)

    useEffect(() => {
        valueRef.current = value
        onChangeRef.current = onChange
    })

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!e.altKey) return
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return

            const active = document.activeElement
            if (!active) return

            const row = active.closest("[data-setting-row]")
            if (!row) return

            const category = row.getAttribute("data-category")
            const title = row.getAttribute("data-title")
            if (!category || !title) return

            e.preventDefault()

            const currentValue = valueRef.current
            const direction = e.key === "ArrowUp" ? -1 : 1

            const nextValue = currentValue.map((c) => {
                if (c.category !== category) return c
                const idx = c.settings.findIndex((s) => s.title === title)
                if (idx === -1) return c
                const newIdx = idx + direction
                if (newIdx < 0 || newIdx >= c.settings.length) return c
                const nextSettings = [...c.settings]
                ;[nextSettings[idx], nextSettings[newIdx]] = [
                    nextSettings[newIdx],
                    nextSettings[idx],
                ]
                return { ...c, settings: nextSettings }
            })

            onChangeRef.current(nextValue)

            // Restore focus after React re-renders
            requestAnimationFrame(() => {
                const newRow = document.querySelector(
                    `[data-setting-row][data-category="${category}"][data-title="${title}"]`,
                )
                const input = newRow?.querySelector(
                    "input, button",
                ) as HTMLElement | null
                input?.focus()
            })
        }

        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [])

    return (
        <div className={`space-y-4 ${className}`}>
            {isEmpty && !showCustomInput && (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg bg-text/5">
                    <p className="text-sm text-text/50 mb-4">
                        No settings configured
                    </p>
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
                    <label className="text-xs font-medium text-text/60 mb-2 block">
                        Category name
                    </label>
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

            {/* Global toolbar */}
            {value.length > 0 && (
                <div className="flex items-center justify-end gap-1">
                    <button
                        onClick={expandAll}
                        disabled={allExpanded}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-text/60 hover:text-text hover:bg-text/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <ChevronUp className="h-3 w-3" />
                        Expand all
                    </button>
                    <button
                        onClick={collapseAll}
                        disabled={allCollapsed}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium text-text/60 hover:text-text hover:bg-text/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                        <ChevronDown className="h-3 w-3" />
                        Collapse all
                    </button>
                </div>
            )}

            <Reorder.Group
                axis="y"
                values={value}
                onReorder={onChange}
                as="div"
                className="space-y-4"
            >
                <AnimatePresence initial={false}>
                    {value.map((cat) => {
                        const isCollapsed = collapsedCategories.has(
                            cat.category,
                        )
                        return (
                            <CategoryCard
                                key={cat.category}
                                cat={cat}
                                isCollapsed={isCollapsed}
                                onToggle={() => toggleCategory(cat.category)}
                                onRemove={() => removeCategory(cat.category)}
                                newSettingNames={newSettingNames}
                                newSettingTypes={newSettingTypes}
                                onNewSettingNameChange={(name) =>
                                    setNewSettingNames((prev) => ({
                                        ...prev,
                                        [cat.category]: name,
                                    }))
                                }
                                onNewSettingTypeChange={(type) =>
                                    setNewSettingTypes((prev) => ({
                                        ...prev,
                                        [cat.category]: type,
                                    }))
                                }
                                onAddSetting={() => addSetting(cat.category)}
                                setAddSettingInputRef={setAddSettingInputRef}
                                onUpdateSetting={updateSetting}
                                onRemoveSetting={removeSetting}
                                onDuplicateSetting={duplicateSetting}
                                onTypeSwitch={cycleSettingType}
                                onReorderSettings={(newSettings) =>
                                    handleReorderSettings(
                                        cat.category,
                                        newSettings,
                                    )
                                }
                                pasteOpen={pasteOpenFor === cat.category}
                                pasteText={pasteText}
                                onPasteTextChange={setPasteText}
                                onTogglePaste={() =>
                                    setPasteOpenFor((prev) =>
                                        prev === cat.category
                                            ? null
                                            : cat.category,
                                    )
                                }
                                onParsePaste={() => parsePaste(cat.category)}
                            />
                        )
                    })}
                </AnimatePresence>
            </Reorder.Group>

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

function CategoryCard({
    cat,
    isCollapsed,
    onToggle,
    onRemove,
    newSettingNames,
    newSettingTypes,
    onNewSettingNameChange,
    onNewSettingTypeChange,
    onAddSetting,
    setAddSettingInputRef,
    onUpdateSetting,
    onRemoveSetting,
    onDuplicateSetting,
    onTypeSwitch,
    onReorderSettings,
    pasteOpen,
    pasteText,
    onPasteTextChange,
    onTogglePaste,
    onParsePaste,
}: {
    cat: SettingCategory
    isCollapsed: boolean
    onToggle: () => void
    onRemove: () => void
    newSettingNames: Record<string, string>
    newSettingTypes: Record<string, string>
    onNewSettingNameChange: (name: string) => void
    onNewSettingTypeChange: (type: string) => void
    onAddSetting: () => void
    setAddSettingInputRef: (
        category: string,
    ) => (el: HTMLInputElement | null) => void
    onUpdateSetting: (
        cat: string,
        title: string,
        val: string | number | boolean,
    ) => void
    onRemoveSetting: (cat: string, title: string) => void
    onDuplicateSetting: (cat: string, title: string) => void
    onTypeSwitch: (cat: string, title: string) => void
    onReorderSettings: (newSettings: SettingItem[]) => void
    pasteOpen: boolean
    pasteText: string
    onPasteTextChange: (text: string) => void
    onTogglePaste: () => void
    onParsePaste: () => void
}) {
    const dragControls = useDragControls()

    return (
        <Reorder.Item
            value={cat}
            dragListener={false}
            dragControls={dragControls}
            as="div"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="border border-border rounded-xl overflow-hidden bg-background shadow-sm"
        >
            {/* Category Header */}
            <div className="flex items-center gap-2 px-3 py-3 bg-text/3">
                {/* Category Drag Handle */}
                <div
                    className="cursor-grab active:cursor-grabbing p-1 rounded text-text/30 hover:text-text/60 hover:bg-text/5 transition-colors shrink-0 select-none touch-none"
                    onPointerDown={(e) => { e.preventDefault(); dragControls.start(e) }}
                >
                    <GripVertical className="h-4 w-4" />
                </div>

                {/* Collapse Toggle */}
                <button
                    onClick={onToggle}
                    className="p-1 rounded text-text/50 hover:text-text hover:bg-text/5 transition-colors cursor-pointer shrink-0"
                >
                    {isCollapsed ? (
                        <ChevronDown className="h-4 w-4" />
                    ) : (
                        <ChevronUp className="h-4 w-4" />
                    )}
                </button>

                {/* Title */}
                <button
                    onClick={onToggle}
                    className="flex-1 text-left text-sm font-semibold text-text hover:text-text/80 transition-colors cursor-pointer flex items-center gap-2"
                >
                    {cat.category}
                    <span className="text-xs text-text/40 font-normal bg-text/5 px-2 py-0.5 rounded-full">
                        {cat.settings.length}
                    </span>
                </button>

                {/* Remove Category */}
                <button
                    onClick={onRemove}
                    className="p-1.5 rounded-md text-text/30 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                    title="Remove category"
                >
                    <X className="h-4 w-4" />
                </button>
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
                        <div className="px-3 pb-4 pt-3 space-y-3">
                            {/* Add setting row at the top */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="flex items-center gap-1 shrink-0">
                                    {typeOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() =>
                                                onNewSettingTypeChange(
                                                    opt.value,
                                                )
                                            }
                                            className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                                                (newSettingTypes[
                                                    cat.category
                                                ] || "text") === opt.value
                                                    ? "bg-primary text-white border-primary"
                                                    : "border-border text-text/60 hover:bg-text/5"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    ref={setAddSettingInputRef(cat.category)}
                                    type="text"
                                    value={newSettingNames[cat.category] || ""}
                                    onChange={(e) =>
                                        onNewSettingNameChange(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            onAddSetting()
                                        }
                                    }}
                                    placeholder="Add setting..."
                                    className="flex-1 min-w-0 px-3 py-1.5 rounded-md border border-border bg-text/5 text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors"
                                />
                                <button
                                    onClick={onAddSetting}
                                    className="p-1.5 rounded-md bg-primary text-white hover:bg-primary/90 transition-colors cursor-pointer shrink-0"
                                    title="Add setting"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={onTogglePaste}
                                    className={`p-1.5 rounded-md border transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                                        pasteOpen
                                            ? "border-primary text-primary bg-primary/10"
                                            : "border-border text-text/50 hover:text-text hover:bg-text/5"
                                    }`}
                                    title="Paste multiple settings"
                                >
                                    <FileInput className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Bulk paste textarea */}
                            <AnimatePresence>
                                {pasteOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="space-y-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                                            <textarea
                                                value={pasteText}
                                                onChange={(e) =>
                                                    onPasteTextChange(
                                                        e.target.value,
                                                    )
                                                }
                                                onKeyDown={(e) => {
                                                    if (
                                                        e.key === "Enter" &&
                                                        e.metaKey
                                                    ) {
                                                        e.preventDefault()
                                                        onParsePaste()
                                                    }
                                                }}
                                                placeholder={`Paste settings like:\nTexture Quality = High\nShadow Quality = Medium\nVSync = Off`}
                                                rows={4}
                                                className="w-full px-3 py-2 rounded-md border border-border bg-background text-text text-sm placeholder:text-text/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-colors resize-y"
                                            />
                                            <div className="flex items-center justify-between">
                                                <p className="text-[10px] text-text/40 leading-relaxed">
                                                    One setting per line. Use{" "}
                                                    <code className="text-text/60 bg-text/5 px-1 rounded">
                                                        =
                                                    </code>
                                                    ,{" "}
                                                    <code className="text-text/60 bg-text/5 px-1 rounded">
                                                        :
                                                    </code>
                                                    , or{" "}
                                                    <code className="text-text/60 bg-text/5 px-1 rounded">
                                                        -
                                                    </code>{" "}
                                                    as separators. Values like
                                                    true/false become toggles,
                                                    numbers become numeric.
                                                    Press{" "}
                                                    <kbd className="text-text/60 bg-text/5 px-1 rounded">
                                                        Cmd+Enter
                                                    </kbd>{" "}
                                                    to add.
                                                </p>
                                                <button
                                                    onClick={onParsePaste}
                                                    disabled={
                                                        !pasteText.trim()
                                                    }
                                                    className="px-3 py-1.5 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                                                >
                                                    Add {cat.settings.length > 0 ? "more" : ""}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Column header — visually aligns with setting rows */}
                            {cat.settings.length > 0 && (
                                <div className="grid grid-cols-[28px_36px_1fr_1fr_56px] gap-2 items-center px-2 pb-1">
                                    <div />
                                    <div className="text-[9px] font-semibold text-text/25 text-center uppercase tracking-wider">
                                        Type
                                    </div>
                                    <div className="text-[9px] font-semibold text-text/25 uppercase tracking-wider px-1">
                                        Setting
                                    </div>
                                    <div className="text-[9px] font-semibold text-text/25 uppercase tracking-wider">
                                        Value
                                    </div>
                                    <div />
                                </div>
                            )}

                            {/* Settings list with drag-to-reorder */}
                            <Reorder.Group
                                axis="y"
                                values={cat.settings}
                                onReorder={onReorderSettings}
                                as="div"
                                className="space-y-2"
                            >
                                <AnimatePresence initial={false}>
                                    {cat.settings.map((setting) => (
                                        <SettingRow
                                            key={setting.title}
                                            setting={setting}
                                            category={cat.category}
                                            onUpdate={onUpdateSetting}
                                            onRemove={onRemoveSetting}
                                            onDuplicate={onDuplicateSetting}
                                            onTypeSwitch={onTypeSwitch}
                                        />
                                    ))}
                                </AnimatePresence>
                            </Reorder.Group>

                            {cat.settings.length === 0 && (
                                <div className="text-center py-6 text-xs text-text/30 italic border border-dashed border-border rounded-lg">
                                    No settings yet — add one above
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Reorder.Item>
    )
}

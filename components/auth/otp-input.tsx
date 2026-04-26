"use client"

import { useRef, useCallback, useMemo } from "react"

interface OtpInputProps {
    length?: number
    value: string
    onChange: (value: string) => void
    disabled?: boolean
    error?: string
}

export default function OtpInput({
    length = 6,
    value,
    onChange,
    disabled = false,
    error,
}: OtpInputProps) {
    const digits = useMemo(
        () =>
            value
                .split("")
                .concat(Array(length).fill(""))
                .slice(0, length),
        [value, length],
    )
    const refs = useRef<(HTMLInputElement | null)[]>([])

    const updateDigits = useCallback(
        (newDigits: string[]) => {
            onChange(newDigits.join(""))
        },
        [onChange],
    )

    const handleChange = useCallback(
        (index: number, val: string) => {
            // Only allow single digit
            const digit = val.replace(/\D/g, "").slice(-1)
            const newDigits = [...digits]
            newDigits[index] = digit
            updateDigits(newDigits)

            // Auto-advance to next box
            if (digit && index < length - 1) {
                refs.current[index + 1]?.focus()
            }
        },
        [digits, length, updateDigits],
    )

    const handleKeyDown = useCallback(
        (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Backspace") {
                if (!digits[index] && index > 0) {
                    // Move to previous box if current is empty
                    refs.current[index - 1]?.focus()
                    const newDigits = [...digits]
                    newDigits[index - 1] = ""
                    updateDigits(newDigits)
                }
            } else if (e.key === "ArrowLeft" && index > 0) {
                refs.current[index - 1]?.focus()
            } else if (e.key === "ArrowRight" && index < length - 1) {
                refs.current[index + 1]?.focus()
            }
        },
        [digits, length, updateDigits],
    )

    const handlePaste = useCallback(
        (e: React.ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault()
            const pasted = e.clipboardData
                .getData("text")
                .replace(/\D/g, "")
                .slice(0, length)
            const newDigits = Array(length).fill("")
            for (let i = 0; i < pasted.length; i++) {
                newDigits[i] = pasted[i]
            }
            updateDigits(newDigits)

            // Focus last filled box or next empty
            const focusIndex = Math.min(pasted.length, length - 1)
            refs.current[focusIndex]?.focus()
        },
        [length, updateDigits],
    )

    return (
        <div>
            <div className="flex gap-2 justify-center">
                {Array.from({ length }).map((_, i) => (
                    <input
                        key={i}
                        ref={(el) => {
                            refs.current[i] = el
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digits[i]}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        onPaste={handlePaste}
                        disabled={disabled}
                        aria-label={`Digit ${i + 1} of ${length}`}
                        className={`w-12 h-14 text-center text-xl font-bold rounded-lg border bg-text/5 text-text outline-none transition-colors ${
                            error
                                ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/50"
                                : "border-border focus:border-primary focus:ring-2 focus:ring-primary/50"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                ))}
            </div>
            {error && (
                <p className="text-red-400 text-sm mt-2 text-center">
                    {error}
                </p>
            )}
        </div>
    )
}

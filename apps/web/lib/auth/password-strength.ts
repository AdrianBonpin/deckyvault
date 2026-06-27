export type StrengthLevel = "weak" | "fair" | "good" | "strong" | "excellent"

export interface PasswordStrength {
    score: number
    level: StrengthLevel
    feedback: string[]
}

const COMMON_PATTERNS = [
    "password",
    "123456",
    "12345678",
    "qwerty",
    "abc123",
    "monkey",
    "master",
    "dragon",
    "login",
    "admin",
    "letmein",
    "welcome",
    "shadow",
    "sunshine",
    "trustno1",
    "iloveyou",
]

export function checkPasswordStrength(password: string): PasswordStrength {
    if (!password) {
        return { score: 0, level: "weak", feedback: ["Enter a password"] }
    }

    let score = 0
    const feedback: string[] = []

    // Length scoring
    if (password.length >= 10) score += 20
    else feedback.push("Use at least 10 characters")

    if (password.length >= 14) score += 10
    else if (password.length >= 10) feedback.push("Use 14+ characters for extra security")

    if (password.length >= 18) score += 10

    // Character variety
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[^A-Za-z0-9]/.test(password)

    if (hasUpper) score += 15
    else feedback.push("Add an uppercase letter")

    if (hasLower) score += 15
    else feedback.push("Add a lowercase letter")

    if (hasNumber) score += 15
    else feedback.push("Add a number")

    if (hasSpecial) score += 15
    else feedback.push("Add a special character (!@#$%^&*)")

    // Common pattern check
    const lower = password.toLowerCase()
    const isCommon = COMMON_PATTERNS.some((p) => lower.includes(p))
    if (!isCommon) score += 10
    else feedback.push("Avoid common passwords")

    // Repeated characters
    const hasRepeated = /(.)\1{2,}/.test(password)
    if (!hasRepeated) score += 5
    else feedback.push("Avoid repeated characters")

    // Mixed positions (not all numbers at end, not all caps at start)
    const endsWithNumbers = /[0-9]+$/.test(password) && !/[0-9]/.test(password.slice(0, -3))
    const startsWithCaps = /^[A-Z]{3,}/.test(password) && !/[A-Z]/.test(password.slice(3))
    if (!endsWithNumbers && !startsWithCaps) score += 5

    // Determine level
    let level: StrengthLevel
    if (score <= 20) level = "weak"
    else if (score <= 40) level = "fair"
    else if (score <= 60) level = "good"
    else if (score <= 80) level = "strong"
    else level = "excellent"

    // If all checks pass, clear feedback
    if (feedback.length === 0) {
        feedback.push("Great password!")
    }

    return { score, level, feedback }
}

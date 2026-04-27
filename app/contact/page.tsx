"use client"

import { useState, useRef } from "react"
import { motion } from "motion/react"
import {
  SendIcon,
  BugIcon,
  DatabaseIcon,
  FlagIcon,
  LightbulbIcon,
  MessageSquareIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  Loader2Icon,
} from "lucide-react"

type Category = "bug" | "game_data" | "user_report" | "feature" | "feedback" | "database"

interface CategoryOption {
  id: Category
  label: string
  icon: React.ElementType
  color: string
}

const CATEGORIES: CategoryOption[] = [
  { id: "bug", label: "Bug Report", icon: BugIcon, color: "text-red-400 border-red-500/20 bg-red-500/5 hover:bg-red-500/10" },
  { id: "game_data", label: "Game Data Issue", icon: AlertTriangleIcon, color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10" },
  { id: "user_report", label: "User Report", icon: FlagIcon, color: "text-blue-400 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10" },
  { id: "feature", label: "Feature Request", icon: LightbulbIcon, color: "text-green-400 border-green-500/20 bg-green-500/5 hover:bg-green-500/10" },
  { id: "feedback", label: "General Feedback", icon: MessageSquareIcon, color: "text-text/60 border-border bg-text/3 hover:bg-text/6" },
  { id: "database", label: "Database Error", icon: DatabaseIcon, color: "text-red-400 border-red-500/20 bg-red-500/5 hover:bg-red-500/10" },
]

export default function ContactPage() {
  const [category, setCategory] = useState<Category | "">("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [gameUrl, setGameUrl] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const timestampRef = useRef<string>("")

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Set timestamp when user starts interacting
  const startTimestamp = () => {
    if (!timestampRef.current) {
      timestampRef.current = Date.now().toString()
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!category) errors.category = "Please select a category"
    if (!subject.trim()) errors.subject = "Subject is required"
    else if (subject.length > 200) errors.subject = "Subject must be 200 characters or less"
    if (!message.trim()) errors.message = "Message is required"
    else if (message.length > 2000) errors.message = "Message must be 2000 characters or less"
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email format"
    if (category === "game_data" && gameUrl && !gameUrl.includes("/game/")) errors.gameUrl = "Please provide a valid DeckyVault game link"

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    startTimestamp()

    if (!validate()) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          name: name || undefined,
          email: email || undefined,
          subject: subject.trim(),
          message: message.trim(),
          gameUrl: category === "game_data" ? gameUrl || undefined : undefined,
          honeypot,
          _timestamp: timestampRef.current || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError("You've sent too many messages. Please try again later.")
        } else {
          setError(data.error || "Something went wrong. Please try again.")
        }
        return
      }

      setSubmitted(true)
    } catch {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <section className="w-full flex flex-col items-center justify-center py-20 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-4"
        >
          <CheckCircleIcon className="h-12 w-12 text-green-400 mx-auto" />
          <h1 className="text-2xl font-bold">Message Sent</h1>
          <p className="text-text/60 text-sm">
            Thank you for reaching out. We&apos;ll review your message as soon as possible.
          </p>
          <button
            onClick={() => {
              setSubmitted(false)
              setCategory("")
              setSubject("")
              setMessage("")
              setGameUrl("")
              setName("")
              setEmail("")
              setHoneypot("")
              timestampRef.current = ""
              setFieldErrors({})
            }}
            className="px-4 py-2 rounded-md bg-text/5 border border-border text-sm hover:bg-text/10 transition-colors cursor-pointer"
          >
            Send another message
          </button>
        </motion.div>
      </section>
    )
  }

  return (
    <section className="w-full flex flex-col items-center py-16 p-4">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl sm:text-3xl font-bold">Contact & Report</h1>
          <p className="text-sm text-text/60 mt-1">
            Report issues, suggest features, or send us feedback.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Honeypot */}
          <input
            type="text"
            name="honeypot"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
            aria-hidden="true"
          />

          {/* Category */}
          <fieldset>
            <legend className="text-xs text-text/50 uppercase tracking-wider mb-2">
              Category <span className="text-primary">*</span>
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id)
                    startTimestamp()
                    setFieldErrors((prev) => {
                      const next = { ...prev }
                      delete next.category
                      return next
                    })
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    category === cat.id
                      ? cat.color + " ring-1 ring-current"
                      : "text-text/50 border-border bg-text/3 hover:bg-text/6"
                  }`}
                >
                  <cat.icon className="h-3.5 w-3.5" />
                  {cat.label}
                </button>
              ))}
            </div>
            {fieldErrors.category && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.category}</p>
            )}
          </fieldset>

          {/* Name & Email (optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact-name" className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
                Name <span className="text-text/30">(optional)</span>
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); startTimestamp() }}
                placeholder="Your name"
                className="w-full bg-text/5 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
                Email <span className="text-text/30">(optional)</span>
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); startTimestamp() }}
                placeholder="you@example.com"
                className="w-full bg-text/5 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors"
              />
              {fieldErrors.email && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.email}</p>
              )}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label htmlFor="contact-subject" className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
              Subject <span className="text-primary">*</span>
            </label>
            <input
              id="contact-subject"
              type="text"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value)
                startTimestamp()
                if (fieldErrors.subject) setFieldErrors((prev) => { const next = { ...prev }; delete next.subject; return next })
              }}
              placeholder="Brief description of your issue"
              maxLength={200}
              className="w-full bg-text/5 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors"
            />
            {fieldErrors.subject && (
              <p className="text-red-400 text-xs mt-1">{fieldErrors.subject}</p>
            )}
          </div>

          {/* Game URL (conditional) */}
          {category === "game_data" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label htmlFor="contact-game-url" className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
                Game URL <span className="text-text/30">(link to the game page)</span>
              </label>
              <input
                id="contact-game-url"
                type="url"
                value={gameUrl}
                onChange={(e) => setGameUrl(e.target.value)}
                placeholder="https://deckyvault.xyz/game/..."
                className="w-full bg-text/5 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors"
              />
              {fieldErrors.gameUrl && (
                <p className="text-red-400 text-xs mt-1">{fieldErrors.gameUrl}</p>
              )}
            </motion.div>
          )}

          {/* Message */}
          <div>
            <label htmlFor="contact-message" className="text-xs text-text/50 uppercase tracking-wider mb-1.5 block">
              Message <span className="text-primary">*</span>
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                startTimestamp()
                if (fieldErrors.message) setFieldErrors((prev) => { const next = { ...prev }; delete next.message; return next })
              }}
              placeholder="Describe your issue, suggestion, or feedback in detail..."
              rows={5}
              maxLength={2000}
              className="w-full bg-text/5 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-colors resize-y"
            />
            <div className="flex justify-between items-center mt-1">
              {fieldErrors.message ? (
                <p className="text-red-400 text-xs">{fieldErrors.message}</p>
              ) : (
                <span />
              )}
              <span className="text-[10px] text-text/30 tabular-nums">{message.length}/2000</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !category}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-primary text-background font-semibold text-sm hover:bg-primary/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <SendIcon className="h-4 w-4" />
                Send Message
              </>
            )}
          </button>
        </motion.form>
      </div>
    </section>
  )
}

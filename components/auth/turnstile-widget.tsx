"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef, useId } from "react"

declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: TurnstileOptions) => string
            reset: (widgetId: string) => void
            remove: (widgetId: string) => void
            getResponse: (widgetId: string) => string | undefined
        }
        onloadTurnstileCallback?: () => void
    }
}

interface TurnstileOptions {
    sitekey: string
    theme?: "light" | "dark" | "auto"
    callback?: (token: string) => void
    "expired-callback"?: () => void
    "error-callback"?: () => void
}

export interface TurnstileWidgetHandle {
    reset: () => void
    getToken: () => string | undefined
}

interface TurnstileWidgetProps {
    onToken: (token: string) => void
    onExpire?: () => void
    onError?: () => void
    theme?: "light" | "dark" | "auto"
}

const SCRIPT_ID = "cf-turnstile-script"
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback&render=explicit"

export default forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(
    function TurnstileWidget({ onToken, onExpire, onError, theme = "auto" }, ref) {
        const containerRef = useRef<HTMLDivElement>(null)
        const widgetIdRef = useRef<string | null>(null)
        const scriptLoadedRef = useRef(false)
        const id = useId()

        // Expose reset and getToken to parent
        useImperativeHandle(ref, () => ({
            reset: () => {
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current)
                }
            },
            getToken: () => {
                if (widgetIdRef.current && window.turnstile) {
                    return window.turnstile.getResponse(widgetIdRef.current)
                }
                return undefined
            },
        }))

        useEffect(() => {
            const container = containerRef.current
            if (!container) return

            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            if (!siteKey) {
                console.warn("[Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set")
                return
            }

            function renderWidget() {
                if (!window.turnstile || !container || !siteKey) return
                // Clear any previous content
                container.innerHTML = ""
                const widgetId = window.turnstile.render(container, {
                    sitekey: siteKey,
                    theme,
                    callback: (token: string) => onToken(token),
                    "expired-callback": () => {
                        widgetIdRef.current = null
                        onExpire?.()
                    },
                    "error-callback": () => {
                        onError?.()
                    },
                })
                widgetIdRef.current = widgetId
                scriptLoadedRef.current = true
            }

            // If script is already loaded, render immediately
            if (window.turnstile) {
                renderWidget()
                return
            }

            // Set up the onload callback before adding the script
            window.onloadTurnstileCallback = renderWidget

            // Avoid injecting the script twice
            if (!document.getElementById(SCRIPT_ID)) {
                const script = document.createElement("script")
                script.id = SCRIPT_ID
                script.src = SRC
                script.async = true
                script.defer = true
                document.head.appendChild(script)
            }

            return () => {
                // Cleanup widget on unmount
                if (widgetIdRef.current && window.turnstile) {
                    window.turnstile.remove(widgetIdRef.current)
                    widgetIdRef.current = null
                }
            }
            // Only run on mount
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        return <div ref={containerRef} id={`turnstile-container-${id}`} className="flex justify-center min-h-[65px]" />
    },
)
"use client"

import { useEffect, useRef, useState } from "react"

const AXIS_THRESHOLD = 0.5
const DEBOUNCE_MS = 150

interface GamepadNavigationOptions {
  /** CSS selector for focusable elements within the container */
  focusSelector?: string
  /** Callback when X button is pressed (typically opens search) */
  onXButton?: () => void
  /** Callback when Y button is pressed (typically toggles filters) */
  onYButton?: () => void
}

/**
 * Hook for gamepad (Steam Deck controller) navigation.
 *
 * Activates only when a gamepad button press is detected.
 * Deactivates on mouse movement or keyboard input.
 * Uses roving tabindex pattern for D-pad and left stick navigation.
 * A button = activate, B button = back, X/Y = context-specific actions.
 * L1/R1 = previous/next tab (if applicable).
 */
export function useGamepadNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  options: GamepadNavigationOptions = {},
) {
  const {
    focusSelector = 'a, button, [role="button"], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    onXButton,
    onYButton,
  } = options

  const [isGamepadActive, setIsGamepadActive] = useState(false)
  const currentIndexRef = useRef(-1)
  const lastInputTimeRef = useRef(0)
  const rafRef = useRef<number>(0)

  // Deactivate gamepad mode on mouse or keyboard input
  useEffect(() => {
    if (!isGamepadActive) return

    const handleMouseMovement = () => {
      setIsGamepadActive(false)
    }

    const handleKeyboardInput = (e: KeyboardEvent) => {
      // Allow Tab key to coexist with gamepad navigation
      if (e.key !== "Tab") {
        setIsGamepadActive(false)
      }
    }

    window.addEventListener("mousemove", handleMouseMovement)
    window.addEventListener("keydown", handleKeyboardInput)

    return () => {
      window.removeEventListener("mousemove", handleMouseMovement)
      window.removeEventListener("keydown", handleKeyboardInput)
    }
  }, [isGamepadActive])

  // Main gamepad polling loop
  useEffect(() => {
    let activated = false

    const poll = () => {
      const gamepads = navigator.getGamepads?.()

      if (!gamepads) {
        rafRef.current = requestAnimationFrame(poll)
        return
      }

      // Find the first connected gamepad
      let gamepad: Gamepad | null = null
      for (const gp of gamepads) {
        if (gp) {
          gamepad = gp
          break
        }
      }

      if (!gamepad) {
        rafRef.current = requestAnimationFrame(poll)
        return
      }

      const now = performance.now()
      if (now - lastInputTimeRef.current < DEBOUNCE_MS) {
        rafRef.current = requestAnimationFrame(poll)
        return
      }

      const container = containerRef.current
      if (!container) {
        rafRef.current = requestAnimationFrame(poll)
        return
      }

      // Auto-activate on first gamepad input
      if (!isGamepadActive && !activated) {
        for (const button of gamepad.buttons) {
          if (button.pressed) {
            setIsGamepadActive(true)
            activated = true
            break
          }
        }
      }

      if (!isGamepadActive) {
        rafRef.current = requestAnimationFrame(poll)
        return
      }

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(focusSelector),
      ).filter((el) => {
        // Skip hidden or disabled elements
        return el.offsetParent !== null && !el.hasAttribute("disabled")
      })

      if (focusable.length === 0) {
        rafRef.current = requestAnimationFrame(poll)
        return
      }

      // D-pad navigation
      const upPressed = gamepad.buttons[12]?.pressed // D-pad up
      const downPressed = gamepad.buttons[13]?.pressed // D-pad down

      // Left stick navigation
      const axisY = gamepad.axes[1] ?? 0
      const stickUp = axisY < -AXIS_THRESHOLD
      const stickDown = axisY > AXIS_THRESHOLD

      // Vertical navigation (primary)
      if (upPressed || stickUp) {
        currentIndexRef.current = Math.max(0, currentIndexRef.current - 1)
        lastInputTimeRef.current = now
      } else if (downPressed || stickDown) {
        currentIndexRef.current = Math.min(
          focusable.length - 1,
          currentIndexRef.current + 1,
        )
        lastInputTimeRef.current = now
      }

      // Ensure index is valid
      currentIndexRef.current = Math.max(
        0,
        Math.min(currentIndexRef.current, focusable.length - 1),
      )

      // Focus the current element
      if (
        currentIndexRef.current >= 0 &&
        currentIndexRef.current < focusable.length
      ) {
        focusable[currentIndexRef.current].focus()
      }

      // A button = activate (click)
      if (gamepad.buttons[0]?.pressed) {
        if (currentIndexRef.current >= 0 && currentIndexRef.current < focusable.length) {
          focusable[currentIndexRef.current].click()
          lastInputTimeRef.current = now
        }
      }

      // B button = back
      if (gamepad.buttons[1]?.pressed) {
        window.history.back()
        lastInputTimeRef.current = now
      }

      // X button = search
      if (gamepad.buttons[2]?.pressed && onXButton) {
        onXButton()
        lastInputTimeRef.current = now
      }

      // Y button = toggle filters
      if (gamepad.buttons[3]?.pressed && onYButton) {
        onYButton()
        lastInputTimeRef.current = now
      }

      rafRef.current = requestAnimationFrame(poll)
    }

    rafRef.current = requestAnimationFrame(poll)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [
    isGamepadActive,
    containerRef,
    focusSelector,
    onXButton,
    onYButton,
  ])

  return { isGamepadActive }
}

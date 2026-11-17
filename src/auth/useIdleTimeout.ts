import { useCallback, useEffect, useRef, useState } from 'react'

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

interface Options {
  /** Total idle time before sign-out. */
  timeoutMs: number
  /** How long before timeout the warning appears. */
  warningMs: number
  onTimeout: () => void
}

/**
 * Tracks user inactivity. Activity while the warning is showing does NOT reset the timer -
 * the user must explicitly choose to stay signed in.
 */
export function useIdleTimeout({ timeoutMs, warningMs, onTimeout }: Options) {
  const [warningVisible, setWarningVisible] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.round(warningMs / 1000))
  const lastActivity = useRef(0)
  const warningRef = useRef(false)
  const onTimeoutRef = useRef(onTimeout)

  useEffect(() => {
    onTimeoutRef.current = onTimeout
  }, [onTimeout])

  const reset = useCallback(() => {
    lastActivity.current = Date.now()
    warningRef.current = false
    setWarningVisible(false)
  }, [])

  useEffect(() => {
    lastActivity.current = Date.now()
    const markActive = () => {
      if (!warningRef.current) lastActivity.current = Date.now()
    }
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, markActive, { passive: true }))

    const interval = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current
      if (idle >= timeoutMs) {
        window.clearInterval(interval)
        onTimeoutRef.current()
        return
      }
      if (idle >= timeoutMs - warningMs) {
        warningRef.current = true
        setWarningVisible(true)
        setSecondsLeft(Math.ceil((timeoutMs - idle) / 1000))
      }
    }, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, markActive))
      window.clearInterval(interval)
    }
  }, [timeoutMs, warningMs])

  return { warningVisible, secondsLeft, reset }
}
